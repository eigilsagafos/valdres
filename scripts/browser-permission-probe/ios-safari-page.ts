/**
 * In-page half of the manual iOS Safari check (see IOS-SAFARI-CHECK.md).
 * Bundled from workspace source by ios-safari.ts. Shows, on the page itself,
 * what a tester needs to record: the environment, each native
 * `requestPermission()` call with the transient-activation state at the moment
 * it ran, what the package resolved, and the live atoms.
 */
import { store } from "valdres"
import {
    motionAtom,
    motionStatusAtom,
    permissionAtom as motionPermissionAtom,
    requestMotionPermission,
} from "../../packages/@valdres/browser-device-motion/src/index"
import {
    orientationAtom,
    orientationStatusAtom,
    permissionAtom as orientationPermissionAtom,
    requestOrientationPermission,
} from "../../packages/@valdres/browser-device-orientation/src/index"

type Entry = { at: string; what: string; detail?: unknown }
const log: Entry[] = []
const time = () => new Date().toISOString().slice(11, 23)
const activation = () => {
    const ua = (navigator as { userActivation?: { isActive: boolean } }).userActivation
    return ua === undefined ? "n/a (no navigator.userActivation)" : ua.isActive
}
const record = (what: string, detail?: unknown) => {
    log.push({ at: time(), what, detail })
    render()
}

// Observe (never change) the native calls the package makes.
for (const [name, ctor] of [
    ["DeviceMotionEvent", (window as any).DeviceMotionEvent],
    ["DeviceOrientationEvent", (window as any).DeviceOrientationEvent],
] as const) {
    const original = ctor?.requestPermission
    if (typeof original !== "function") continue
    ctor.requestPermission = function (...args: unknown[]) {
        record(`${name}.requestPermission() called`, { activation: activation() })
        const answer = original.apply(this, args)
        Promise.resolve(answer).then(
            value => record(`${name}.requestPermission() resolved`, value),
            error => record(`${name}.requestPermission() rejected`, String(error?.name ?? error)),
        )
        return answer
    }
}

const app = store()
let motionEvents = 0
let orientationEvents = 0
app.sub(motionAtom, () => {
    motionEvents++
    render()
})
app.sub(orientationAtom, () => {
    orientationEvents++
    render()
})
for (const state of [motionStatusAtom, motionPermissionAtom, orientationStatusAtom, orientationPermissionAtom])
    app.sub(state, render)

const environment = {
    userAgent: navigator.userAgent,
    isSecureContext: window.isSecureContext,
    motionRequestPermission: typeof (window as any).DeviceMotionEvent?.requestPermission,
    orientationRequestPermission: typeof (window as any).DeviceOrientationEvent?.requestPermission,
    permissionsApi: typeof navigator.permissions?.query,
    userActivationApi: typeof (navigator as any).userActivation,
}

const snapshot = () => ({
    environment,
    motion: {
        status: app.get(motionStatusAtom),
        permission: app.get(motionPermissionAtom),
        events: motionEvents,
        last: app.get(motionAtom),
    },
    orientation: {
        status: app.get(orientationStatusAtom),
        permission: app.get(orientationPermissionAtom),
        events: orientationEvents,
        last: app.get(orientationAtom),
    },
    log,
})

function render() {
    const out = document.getElementById("out")
    if (out) out.textContent = JSON.stringify(snapshot(), null, 2)
    const state = document.getElementById("state")
    if (state === null) return
    const motion = app.get(motionPermissionAtom)
    const orientation = app.get(orientationPermissionAtom)
    state.textContent =
        motion === "prompt" && orientation === "prompt"
            ? "Unanswered on this page: the no-gesture (C) and prompt (A/B) checks are meaningful now."
            : `Answered on this page (motion ${motion}, orientation ${orientation}). iOS answers motion and orientation together, so A, B and C now return that answer without a prompt. Use a fresh origin or clear website data to re-test prompting.`
}

const on = (id: string, handler: () => void) =>
    document.getElementById(id)!.addEventListener("click", handler)

// The package call happens directly inside the click: no await before it.
on("motion", () => {
    record("tap: requestMotionPermission()")
    requestMotionPermission().then(value => record("requestMotionPermission resolved", value))
})
on("orientation", () => {
    record("tap: requestOrientationPermission()")
    requestOrientationPermission().then(value =>
        record("requestOrientationPermission resolved", value),
    )
})
// Outside any gesture: the activation has expired after 6 s.
on("no-gesture", () => {
    record("tap: scheduled requestMotionPermission() in 6 s (no gesture)")
    setTimeout(() => {
        requestMotionPermission().then(value =>
            record("no-gesture requestMotionPermission resolved", value),
        )
    }, 6000)
})
on("copy", () => {
    const text = JSON.stringify(snapshot(), null, 2)
    navigator.clipboard?.writeText(text).then(
        () => record("copied results to clipboard"),
        () => record("clipboard unavailable: select the results below"),
    )
})
render()
