import type { MotionState } from "../types/MotionState"
import { invalidateAll } from "./invalidateAll"
import { toSnapshot } from "./toSnapshot"

export const IDLE: MotionState = Object.freeze({ status: "idle", motion: null })
const LISTENING: MotionState = Object.freeze({ status: "active", motion: null })

interface MotionHub {
    state: MotionState
    readonly registrations: Set<() => void>
    readonly detach: () => void
}

// Weak so a discarded window (a removed iframe realm) releases its hub.
const hubs = new WeakMap<Window, MotionHub>()

/** What the window's attached hub last published, if a store tree retains one. */
export const peekMotionHub = (view: Window): MotionState | undefined =>
    hubs.get(view)?.state

/**
 * One `devicemotion` listener per window, shared by every store tree that
 * retains the source and removed with the last one. The hub caches the latest
 * reading, since the platform offers no way to sample motion; detaching
 * discards it, so a later attachment never reports a stale reading.
 */
export const retainMotionHub = (
    view: Window,
    invalidate: () => void,
): (() => void) => {
    let hub = hubs.get(view)
    if (hub === undefined) {
        const registrations = new Set<() => void>()
        const onMotion = (event: Event) => {
            const current = hubs.get(view)
            if (current !== created) return
            created.state = Object.freeze({
                status: "active",
                motion: toSnapshot(event as DeviceMotionEvent),
            })
            invalidateAll(registrations, "Device motion invalidation failed")
        }
        const created: MotionHub = {
            state: LISTENING,
            registrations,
            detach: () => view.removeEventListener("devicemotion", onMotion),
        }
        view.addEventListener("devicemotion", onMotion)
        hubs.set(view, (hub = created))
    }
    const owner = hub
    // A fresh function per registration: the same invalidator may never be
    // registered twice, but two trees must not share one entry either.
    const registration = () => invalidate()
    owner.registrations.add(registration)
    return () => {
        if (!owner.registrations.delete(registration)) return
        if (owner.registrations.size > 0) return
        if (hubs.get(view) === owner) hubs.delete(view)
        owner.detach()
    }
}
