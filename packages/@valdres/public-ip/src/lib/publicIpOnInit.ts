import type { GlobalAtom } from "valdres"
import { fetchPublicIp } from "../utils/fetchPublicIp"

interface NetworkInformationLike {
    addEventListener: (type: "change", listener: () => void) => void
    removeEventListener: (type: "change", listener: () => void) => void
}

interface NavigatorWithConnection extends Navigator {
    connection?: NetworkInformationLike
}

const refetchHandlers = new Set<() => void>()
let cleanupSharedListeners: (() => void) | null = null

const dispatch = () => {
    for (const handler of refetchHandlers) handler()
}

const registerSharedListeners = () => {
    if (cleanupSharedListeners) return
    const win = typeof window === "undefined" ? undefined : window
    const doc = typeof document === "undefined" ? undefined : document
    const nav =
        typeof navigator === "undefined"
            ? undefined
            : (navigator as NavigatorWithConnection)
    const connection = nav?.connection

    const onOnline = () => dispatch()
    const onVisibility = () => {
        if (doc?.visibilityState === "visible") dispatch()
    }
    const onConnectionChange = () => dispatch()

    win?.addEventListener?.("online", onOnline)
    doc?.addEventListener?.("visibilitychange", onVisibility)
    connection?.addEventListener?.("change", onConnectionChange)

    cleanupSharedListeners = () => {
        win?.removeEventListener?.("online", onOnline)
        doc?.removeEventListener?.("visibilitychange", onVisibility)
        connection?.removeEventListener?.("change", onConnectionChange)
        cleanupSharedListeners = null
    }
}

export const publicIpOnInit = (
    ipAtom: GlobalAtom<Promise<string> | string>,
    endpointsAtom: GlobalAtom<string[]>,
    validate: (value: string) => boolean,
) => {
    const handler = () => {
        const nav = typeof navigator === "undefined" ? undefined : navigator
        if (nav && nav.onLine === false) return
        ipAtom.setSelf(fetchPublicIp(endpointsAtom.getSelf(), validate))
    }
    refetchHandlers.add(handler)
    registerSharedListeners()

    return () => {
        refetchHandlers.delete(handler)
        if (refetchHandlers.size === 0) cleanupSharedListeners?.()
    }
}
