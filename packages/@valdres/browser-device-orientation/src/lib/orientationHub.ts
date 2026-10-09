import type { OrientationState } from "../types/OrientationState"
import { invalidateAll } from "./invalidateAll"
import { toSnapshot } from "./toSnapshot"

export const IDLE: OrientationState = Object.freeze({ status: "idle", orientation: null })
const LISTENING: OrientationState = Object.freeze({ status: "active", orientation: null })

interface OrientationHub {
    state: OrientationState
    readonly registrations: Set<() => void>
    readonly detach: () => void
}

// Weak so a discarded window (a removed iframe realm) releases its hub.
const hubs = new WeakMap<Window, OrientationHub>()

/** What the window's attached hub last published, if a store tree retains one. */
export const peekOrientationHub = (view: Window): OrientationState | undefined =>
    hubs.get(view)?.state

/**
 * One `deviceorientation` listener per window, shared by every store tree that
 * retains the source and removed with the last one. The hub caches the latest
 * reading, since the platform offers no way to sample orientation; detaching
 * discards it, so a later attachment never reports a stale reading.
 */
export const retainOrientationHub = (
    view: Window,
    invalidate: () => void,
): (() => void) => {
    let hub = hubs.get(view)
    if (hub === undefined) {
        const registrations = new Set<() => void>()
        const onOrientation = (event: Event) => {
            const current = hubs.get(view)
            if (current !== created) return
            created.state = Object.freeze({
                status: "active",
                orientation: toSnapshot(event as DeviceOrientationEvent),
            })
            invalidateAll(registrations, "Device orientation invalidation failed")
        }
        const created: OrientationHub = {
            state: LISTENING,
            registrations,
            detach: () => view.removeEventListener("deviceorientation", onOrientation),
        }
        view.addEventListener("deviceorientation", onOrientation)
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
