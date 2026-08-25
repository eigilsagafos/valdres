import type { GetValue } from "../types/GetValue"
import type { State } from "../types/State"
import type { Store } from "../types/Store"
import { COMMITTED_READ_ACCESS } from "./committedReadAccessToken"
import { getStoreData } from "./getStoreData"

/** Versioned, capability-based access for framework and tooling adapters. */
export const storeAdapter = Object.freeze({
    isBatching(store: Store): boolean {
        return getStoreData(store).batchUpdates === true
    },
    isEnumerable(store: Store): boolean {
        return getStoreData(store).enumerable === true
    },
    /**
     * Read the value a subscriber has actually been notified about.
     *
     * On a `batchUpdates` store, `store.get` answers from the open batch so a
     * writer reads its own writes back immediately. A subscription-driven
     * consumer needs the opposite: staged writes are announced only when the
     * batch commits, so reading them early yields a value no callback has
     * accompanied. React's `useSyncExternalStore` treats exactly that as
     * tearing — its post-commit check re-reads `getSnapshot`, sees a value the
     * render did not produce, and calls `forceStoreRerender`; under a burst of
     * writes it does so on every commit and hits "Maximum update depth
     * exceeded". This read ignores the open batch, so snapshot and notification
     * stay in phase.
     *
     * Identical to `store.get` on a non-batched store.
     */
    committedGet<V>(store: Store, state: State<V>): V {
        // A foreign same-version package copy answers its own token, not this
        // one (the reason getStoreData carries the globalStore special case).
        // Degrade to the public read rather than throwing: the batched-read
        // phase skew is a correctness wart, not a crash.
        const committedRead = (
            store.txn as unknown as (
                token: typeof COMMITTED_READ_ACCESS,
            ) => GetValue | undefined
        )(COMMITTED_READ_ACCESS)
        return typeof committedRead === "function"
            ? (committedRead(state) as V)
            : (store.get(state) as V)
    },
    /** @deprecated Public since 1.0.0-beta.20 as `store.hasScope(scopeId)`.
     *  Kept so an adapter pinned to this capability object keeps working; it
     *  now just forwards. */
    hasScope(store: Store, scopeId: string): boolean {
        return store.hasScope(scopeId)
    },
    hasScopePath(store: Store, scopeIds: readonly string[]): boolean {
        let data = getStoreData(store)
        for (const scopeId of scopeIds) {
            const scope = data.scopes.get(scopeId)
            if (!scope) return false
            data = scope
        }
        return true
    },
})
