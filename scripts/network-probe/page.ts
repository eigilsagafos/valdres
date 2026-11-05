/**
 * In-page half of the network probe; see run.ts. Bundled from workspace
 * source. Listener registration on window, document and navigator.connection
 * is wrapped before the packages load, so import- or subscription-time
 * attachment would be recorded. Every request the page makes is held by the
 * driver (DevTools Fetch interception) and answered locally.
 */
const attached: string[] = []
const wrap = (label: string, target: EventTarget | undefined) => {
    if (target === undefined) return
    const add = target.addEventListener
    target.addEventListener = function (
        this: EventTarget,
        type: string,
        ...rest: any[]
    ) {
        attached.push(`${label}:${type}`)
        return (add as any).call(this, type, ...rest)
    } as typeof target.addEventListener
}
const connection = (navigator as { connection?: EventTarget }).connection
wrap("window", window)
wrap("document", document)
wrap("connection", connection)

const reported: { name: string; message: string }[] = []
window.addEventListener("error", event => {
    const error = event.error as { name?: string; message?: string } | undefined
    reported.push({
        name: String(error?.name),
        message: String(error?.message),
    })
    event.preventDefault()
})
// The probe's own listener is not the packages'.
attached.length = 0

const { store } = await import("valdres")
const ip = await import("../../packages/@valdres/public-ip/src/index")
const bw = await import("../../packages/@valdres/bandwidth/src/index")

const root = store()
const child = root.scope()
const other = store()
const log: Record<string, string[]> = {
    root: [],
    child: [],
    other: [],
    bandwidth: [],
}
const label = (state: {
    status: string
    ip?: string | null
    phase?: string | null
}) =>
    "ip" in state
        ? `${state.status}:${state.ip ?? "-"}`
        : state.phase
          ? `${state.status}/${state.phase}`
          : state.status

const controllers = new Map<string, AbortController>()
const outcomes = new Map<string, Promise<unknown>>()
const outcome = (promise: Promise<unknown>) =>
    promise.then(
        value => ({ ok: true, value }),
        (error: {
            name?: string
            message?: string
            errors?: { message?: string }[]
        }) => ({
            ok: false,
            name: String(error?.name),
            message: String(error?.message),
            causes: error?.errors?.map(cause => String(cause?.message)),
        }),
    )

const snapshot = () => ({
    any: root.get(ip.publicIpAtom),
    v4: root.get(ip.publicIpV4Atom),
    v6: root.get(ip.publicIpV6Atom),
    childAny: child.get(ip.publicIpAtom),
    bandwidth: root.get(bw.bandwidthAtom),
    log,
    attached: [...attached],
    reported: [...reported],
})

;(window as any).networkProbe = {
    environment: () => ({
        userAgent: navigator.userAgent,
        hasConnection: connection !== undefined,
        secure: isSecureContext,
    }),
    afterImport: () => ({
        attached: [...attached],
        dormant: root.get(ip.publicIpAtom),
    }),
    subscribe: () => {
        root.sub(ip.publicIpAtom, () =>
            log.root!.push(label(root.get(ip.publicIpAtom))),
        )
        child.sub(ip.publicIpAtom, () =>
            log.child!.push(label(child.get(ip.publicIpAtom))),
        )
        other.sub(ip.publicIpAtom, () =>
            log.other!.push(label(other.get(ip.publicIpAtom))),
        )
        root.sub(ip.publicIpV4ValueAtom, () => {})
        root.sub(ip.publicIpV6StatusAtom, () => {})
        root.sub(bw.bandwidthAtom, () => {
            const next = label(root.get(bw.bandwidthAtom))
            if (log.bandwidth!.at(-1) !== next) log.bandwidth!.push(next)
        })
        // Events the legacy package refetched on.
        window.dispatchEvent(new Event("online"))
        document.dispatchEvent(new Event("visibilitychange"))
        return snapshot()
    },
    /** Starts an operation; the driver answers its requests. */
    start: (
        id: string,
        kind: "ip" | "bandwidth",
        options: Record<string, unknown> = {},
    ) => {
        const controller = new AbortController()
        controllers.set(id, controller)
        const signal = options.cancellable ? controller.signal : undefined
        const { cancellable: _, ...rest } = options
        outcomes.set(
            id,
            outcome(
                kind === "ip"
                    ? ip.requestPublicIp({ ...rest, signal })
                    : bw.measureBandwidth({ ...rest, signal }),
            ),
        )
        return snapshot()
    },
    abort: (id: string) => {
        controllers.get(id)!.abort()
        return snapshot()
    },
    outcome: (id: string) => outcomes.get(id),
    snapshot,
    setCookie: () => {
        document.cookie = "probe=should-not-be-sent; path=/"
        return document.cookie
    },
    throwingStore: () => {
        const noisy = store()
        noisy.sub(ip.publicIpV6Atom, () => {
            throw new Error("probe subscriber bug")
        })
    },
    disposeOther: () => {
        other.dispose()
        return snapshot()
    },
}
