import type { GlobalAtom } from "valdres"

interface NetworkInformationLike {
    addEventListener: (type: "change", listener: () => void) => void
    removeEventListener: (type: "change", listener: () => void) => void
}

interface NavigatorWithConnection extends Navigator {
    connection?: NetworkInformationLike
}

const CONNECTION_CHANGE_DEBOUNCE_MS = 750

const refetchHandlers = new Set<() => void>()
let cleanupSharedListeners: (() => void) | null = null
let debounceTimer: ReturnType<typeof setTimeout> | null = null

const dispatch = () => {
    for (const handler of refetchHandlers) handler()
}

const dispatchDebounced = () => {
    if (debounceTimer !== null) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
        debounceTimer = null
        dispatch()
    }, CONNECTION_CHANGE_DEBOUNCE_MS)
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
    const onConnectionChange = () => dispatchDebounced()

    win?.addEventListener?.("online", onOnline)
    doc?.addEventListener?.("visibilitychange", onVisibility)
    connection?.addEventListener?.("change", onConnectionChange)

    cleanupSharedListeners = () => {
        win?.removeEventListener?.("online", onOnline)
        doc?.removeEventListener?.("visibilitychange", onVisibility)
        connection?.removeEventListener?.("change", onConnectionChange)
        if (debounceTimer !== null) {
            clearTimeout(debounceTimer)
            debounceTimer = null
        }
        cleanupSharedListeners = null
    }
}

export const subscribe = (
    ipAtom: GlobalAtom<Promise<string> | string>,
    runFetch: () => Promise<string>,
) => {
    const handler = () => {
        const nav = typeof navigator === "undefined" ? undefined : navigator
        if (nav && nav.onLine === false) return
        const promise = runFetch()
        promise.catch(() => {})
        ipAtom.setSelf(promise)
    }
    refetchHandlers.add(handler)
    registerSharedListeners()

    return () => {
        refetchHandlers.delete(handler)
        if (refetchHandlers.size === 0) cleanupSharedListeners?.()
    }
}
