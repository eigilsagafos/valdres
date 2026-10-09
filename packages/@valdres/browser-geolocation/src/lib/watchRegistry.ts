import { externalAtom, type ExternalAtom, type Store } from "valdres"
import { watchSessionAtom } from "../atoms/watchSessionAtom"
import { GeolocationWatchConflictError } from "../errors/GeolocationWatchConflictError"
import type { GeolocationState } from "../types/GeolocationState"
import type { GeolocationWatchOptions } from "../types/GeolocationWatchOptions"
import { normalizeOptions, sameOptions, type NormalizedOptions } from "./normalizeOptions"
import { createWatchSource } from "./watchSource"

interface Session {
    readonly state: ExternalAtom<GeolocationState>
    readonly options: NormalizedOptions
    readonly stop: () => void
    holders: number
}

// Keyed by the exact Store object: a scope is a Store of its own.
const sessions = new WeakMap<Store, Session>()

const isDeferrable = (error: unknown) => {
    const name = (error as { name?: unknown } | null)?.name
    return name === "TransactionPhaseError" || name === "CallbackCapabilityError"
}
const isDisposed = (error: unknown) =>
    (error as { name?: unknown } | null)?.name === "StoreDisposedError"

/**
 * Moves the store's readers off the session, then releases the session's
 * subscription, which clears the native watch. Inside a transaction or a
 * subscriber callback, where Store writes are forbidden, it finishes in a
 * microtask; a disposed store already released everything.
 */
const release = (store: Store, session: Session): void => {
    try {
        if (store.get(watchSessionAtom) === session.state) store.reset(watchSessionAtom)
        session.stop()
    } catch (error) {
        if (isDisposed(error)) return
        if (!isDeferrable(error)) throw error
        queueMicrotask(() => release(store, session))
    }
}

/**
 * Starts (or joins) `store`'s watch. Everything that can throw runs before
 * anything is recorded, so a failed call leaves no watch behind.
 */
export const startWatch = (
    store: Store,
    options: GeolocationWatchOptions | undefined,
): (() => void) => {
    const requested = normalizeOptions(options)
    // Throws StoreDisposedError for a disposed store, before any bookkeeping.
    store.get(watchSessionAtom)
    let session = sessions.get(store)
    if (session !== undefined) {
        if (!sameOptions(session.options, requested))
            throw new GeolocationWatchConflictError(session.options, requested)
        session.holders++
    } else {
        const state = externalAtom(createWatchSource(requested), {
            name: "@valdres/browser-geolocation/watch",
        })
        store.set(watchSessionAtom, state)
        let stop: () => void
        try {
            // Starts navigator.geolocation.watchPosition, synchronously.
            stop = store.sub(state, () => {})
        } catch (error) {
            store.reset(watchSessionAtom)
            throw error
        }
        session = { state, options: requested, stop, holders: 1 }
        sessions.set(store, session)
    }
    const held = session
    let released = false
    return () => {
        if (released) return
        released = true
        if (--held.holders > 0) return
        if (sessions.get(store) === held) sessions.delete(store)
        release(store, held)
    }
}

/** @internal For tests: the store's own session, if any. */
export const inspectWatch = (store: Store) => {
    const session = sessions.get(store)
    return session === undefined
        ? undefined
        : { holders: session.holders, options: session.options }
}
