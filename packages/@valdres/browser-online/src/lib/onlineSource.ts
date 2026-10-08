import type { ExternalSource } from "valdres"

/**
 * Reported when connectivity cannot be observed — during server rendering and
 * in runtimes without a boolean `navigator.onLine` (Node, Bun, Deno) or without
 * a target that fires `online` / `offline`. `true` matches the platform's own
 * convention: `navigator.onLine` only reports `false` when the browser knows it
 * has no network, so "online" is the no-information answer.
 */
export const ONLINE_UNAVAILABLE = true

interface OnlineHost {
    readonly navigator: Navigator
    readonly target: EventTarget
}

/**
 * Resolved on every call, never at import: importing reads no browser global,
 * and a host that appears later is picked up. A document's `window` and a
 * worker's global scope both fire `online` / `offline`; both are observable.
 */
const resolveHost = (): OnlineHost | undefined => {
    if (typeof navigator === "undefined") return undefined
    if (typeof navigator.onLine !== "boolean") return undefined
    const target: EventTarget = typeof window !== "undefined" ? window : globalThis
    if (typeof target.addEventListener !== "function") return undefined
    return { navigator, target }
}

const EVENTS = ["online", "offline"] as const

export const onlineSource: ExternalSource<boolean> = {
    getSnapshot: () => resolveHost()?.navigator.onLine ?? ONLINE_UNAVAILABLE,
    getServerSnapshot: () => ONLINE_UNAVAILABLE,
    subscribe: invalidate => {
        const host = resolveHost()
        if (host === undefined) return () => {}
        const attached: string[] = []
        const detach = () => {
            for (const type of attached.splice(0))
                host.target.removeEventListener(type, invalidate)
        }
        try {
            for (const type of EVENTS) {
                host.target.addEventListener(type, invalidate)
                attached.push(type)
            }
        } catch (error) {
            // A half-attached source would miss one direction of change
            // forever. Release what was installed and let the core surface it.
            detach()
            throw error
        }
        return detach
    },
}
