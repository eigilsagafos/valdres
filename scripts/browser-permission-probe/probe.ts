/**
 * In-page half of the browser-permission probe; see serve.ts. Bundled from
 * workspace source. Every native call the packages may make is wrapped first,
 * recording whether it ran with transient user activation
 * (`navigator.userActivation.isActive`) — the wrappers only observe and
 * forward. Nothing here acquires a real location or reads a real sensor unless
 * the browser running the page provides one; the automated driver replaces
 * both with DevTools overrides before anything starts.
 */
type Call = { readonly api: string; readonly activated: boolean | null }
const calls: Call[] = []
const activated = () =>
    (navigator as { userActivation?: { isActive: boolean } }).userActivation
        ?.isActive ?? null
const wrap = (owner: any, key: string, api: string) => {
    const original = owner?.[key]
    if (typeof original !== "function") return
    Object.defineProperty(owner, key, {
        configurable: true,
        writable: true,
        value(this: unknown, ...args: unknown[]) {
            calls.push({ api, activated: activated() })
            return original.apply(this, args)
        },
    })
}
wrap((window as any).DeviceMotionEvent, "requestPermission", "DeviceMotionEvent.requestPermission")
wrap((window as any).DeviceOrientationEvent, "requestPermission", "DeviceOrientationEvent.requestPermission")
wrap(navigator.geolocation, "watchPosition", "geolocation.watchPosition")
wrap(navigator.geolocation, "clearWatch", "geolocation.clearWatch")
wrap(navigator.geolocation, "getCurrentPosition", "geolocation.getCurrentPosition")
wrap(window, "getScreenDetails", "getScreenDetails")
wrap(navigator.permissions, "query", "permissions.query")
const listenerCounts = new Map<string, number>()
const addListener = window.addEventListener
const removeListener = window.removeEventListener
window.addEventListener = function (this: Window, type: string, ...rest: any[]) {
    if (type.startsWith("device"))
        listenerCounts.set(type, (listenerCounts.get(type) ?? 0) + 1)
    return (addListener as any).call(this, type, ...rest)
} as typeof window.addEventListener
window.removeEventListener = function (this: Window, type: string, ...rest: any[]) {
    if (type.startsWith("device"))
        listenerCounts.set(type, (listenerCounts.get(type) ?? 0) - 1)
    return (removeListener as any).call(this, type, ...rest)
} as typeof window.removeEventListener
const reported: { name: string; causes: string[] }[] = []
window.addEventListener("error", event => {
    const error = event.error as { name?: string; causes?: unknown[]; message?: string }
    reported.push({
        name: String(error?.name ?? "unknown"),
        causes: (error?.causes ?? [error?.message]).map(String),
    })
    event.preventDefault()
})

const { store } = await import("valdres")
const motion = await import("../../packages/@valdres/browser-device-motion/src/index")
const orientation = await import("../../packages/@valdres/browser-device-orientation/src/index")
const geo = await import("../../packages/@valdres/browser-geolocation/src/index")
const screens = await import("../../packages/@valdres/browser-screen-details/src/index")

const importCalls = calls.length
const failing = store()
const healthy = store()
const child = healthy.scope()
const results: Record<string, unknown> = {}
const seen = { failing: 0, healthy: [] as unknown[] }
const stops: (() => void)[] = []
let geoStops: Record<string, () => void> = {}

/** Reads through a store that may already be disposed. */
const read = <Value>(app: { get(state: unknown): unknown }, state: unknown): Value | "disposed" => {
    try {
        return app.get(state) as Value
    } catch (error) {
        if ((error as Error).name === "StoreDisposedError") return "disposed"
        throw error
    }
}

const snapshot = () => ({
    calls: [...calls],
    listeners: Object.fromEntries(listenerCounts),
    reported: [...reported],
    results: { ...results },
    seen: { failing: seen.failing, healthy: [...seen.healthy] },
    motion: {
        status: read<any>(healthy, motion.motionStatusAtom),
        acceleration: read<any>(healthy, motion.accelerationIncludingGravitySelector),
        failingAcceleration: read<any>(failing, motion.accelerationIncludingGravitySelector),
        permission: read<any>(healthy, motion.permissionAtom),
    },
    orientation: {
        status: read<any>(healthy, orientation.orientationStatusAtom),
        alpha: read<any>(healthy, orientation.alphaSelector),
        permission: read<any>(healthy, orientation.permissionAtom),
    },
    geo: {
        healthy: read<any>(healthy, geo.geolocationAtom),
        child: read<any>(child, geo.geolocationAtom),
        failing: read<any>(failing, geo.geolocationAtom),
        permission: read<any>(healthy, geo.permissionAtom),
    },
    screens: {
        state: read<any>(healthy, screens.screenDetailsAtom),
        permission: read<any>(healthy, screens.screenPermissionAtom),
    },
    secure: window.isSecureContext,
})

const button = (id: string, label: string, run: () => Promise<unknown> | unknown) => {
    const element = document.createElement("button")
    element.id = id
    element.textContent = label
    // Called synchronously inside the click: the gesture's activation is the
    // one the native call sees.
    element.addEventListener("click", () => {
        Promise.resolve(run()).then(
            value => (results[id] = { ok: value }),
            error => (results[id] = { error: String(error?.name ?? error) }),
        )
    })
    document.getElementById("controls")!.append(element)
}

button("request-motion", "requestMotionPermission()", () => motion.requestMotionPermission())
button("request-orientation", "requestOrientationPermission()", () =>
    orientation.requestOrientationPermission(),
)
button("watch-geolocation", "watchGeolocation(healthy, high accuracy)", () => {
    geoStops.healthy = geo.watchGeolocation(healthy, { enableHighAccuracy: true })
    return "started"
})
button("request-screens", "requestScreenDetails()", () =>
    screens.requestScreenDetails().then(list => list?.length ?? null),
)

;(window as any).permissionProbe = {
    importCalls: () => importCalls,
    snapshot,
    subscribeAll: () => {
        stops.push(
            failing.sub(motion.motionAtom, () => {
                seen.failing++
                throw new Error("intentional permission probe subscriber failure")
            }),
            healthy.sub(motion.accelerationIncludingGravitySelector, () =>
                seen.healthy.push(healthy.get(motion.accelerationIncludingGravitySelector)),
            ),
            child.sub(orientation.alphaSelector, () => {}),
            healthy.sub(motion.permissionAtom, () => {}),
            healthy.sub(geo.geolocationAtom, () => {}),
            healthy.sub(geo.permissionAtom, () => {}),
            failing.sub(geo.geolocationAtom, () => {}),
            healthy.sub(screens.screensAtom, () => {}),
            healthy.sub(screens.screenPermissionAtom, () => {}),
        )
        return snapshot()
    },
    requestMotionWithoutGesture: () => motion.requestMotionPermission(),
    watchFailing: (options: object) => {
        geoStops.failing = geo.watchGeolocation(failing, options)
    },
    watchChild: (options: object) => {
        geoStops.child = geo.watchGeolocation(child, options)
    },
    conflict: () => {
        try {
            geo.watchGeolocation(healthy, { enableHighAccuracy: false })()
            return "no error"
        } catch (error) {
            return (error as Error).name
        }
    },
    stopGeo: (name: string) => geoStops[name]?.(),
    disposeFailing: () => failing.dispose(),
    disposeAll: () => {
        for (const stop of stops.splice(0)) stop()
        for (const stop of Object.values(geoStops)) stop()
        geoStops = {}
        child.dispose()
        healthy.dispose()
        try {
            failing.dispose()
        } catch {}
        return snapshot()
    },
}
document.getElementById("status")!.textContent = "ready"
