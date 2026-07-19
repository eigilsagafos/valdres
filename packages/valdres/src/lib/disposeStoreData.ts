import type { GlobalAtom } from "../types/GlobalAtom"
import type { StoreData } from "../types/StoreData"
import { unmountAtom } from "./mountAtom"
import { commitEndRegistry } from "./onCommitEnd"
import { changeListenerRegistry } from "./notifyChangeListeners"
import { unsubscribe } from "./unsubscribe"
import {
    DISPOSED_STORE_PENDING,
    getStoreDisposedErrorToken,
    getTouchedGlobals,
    markStoreDisposed,
    releaseStoreResources,
    takeAbortControllers,
    takeStoreCleanups,
    takeStoreMounts,
} from "./storeLifecycle"
import { takeStoreSubscriptionStates } from "./storeSubscriptions"

type StoreGlobals = [StoreData, GlobalAtom<any>[]]

/**
 * Dispose one store tree in time proportional to its scopes and touched global
 * atoms. Global registrations are removed before user cleanup runs, so a
 * throwing cleanup cannot leave a store retained or in future fan-out paths.
 */
export const disposeStoreData = (data: StoreData): void => {
    const disposalToken = {}
    const tree: StoreData[] = [data]
    for (let i = 0; i < tree.length; i++) {
        for (const child of tree[i].scopes.values()) tree.push(child)
    }

    const globalsByStore: StoreGlobals[] = []
    for (const current of tree) {
        // Mark the whole tree terminal before any user cleanup can run. Promise
        // settlements and implicit batched commits use this to discard work
        // queued by a request that has already finished.
        const touched = getTouchedGlobals(current)
        if (touched?.size) globalsByStore.push([current, [...touched]])
        markStoreDisposed(current, disposalToken)
        // Reuse the existing public-operation orphan guard as the terminal
        // facade marker. This also replaces and releases any queued roots.
        current.pendingOrphanCleanup = DISPOSED_STORE_PENDING

        // Unlink scopes while their scopeIndexKeys are still available. This is
        // also what the ref-counted ScopedStore.detach() path needs to release.
        const parent = current.parent
        if (parent) {
            if (parent.scopes.get(current.id) === current) {
                parent.scopes.delete(current.id)
            }
            const indexKeys = current.scopeIndexKeys
            if (indexKeys) {
                for (const key of indexKeys) {
                    const scopes = parent.scopeValueIndex.get(key)
                    if (!scopes) continue
                    scopes.delete(current)
                    if (scopes.size === 0) parent.scopeValueIndex.delete(key)
                }
                indexKeys.clear()
            }
            current.scopeConsumers?.clear()
        }
        current.scopes.clear()
    }

    // First sever every strong globalAtom -> StoreData edge. Cleanup below can
    // execute user code and throw; neither may strand a registration.
    for (const [current, globals] of globalsByStore) {
        for (const atom of globals) atom.detach(current)
    }

    let firstError: unknown
    let hasError = false
    const recordError = (error: unknown) => {
        // Cleanup is intentionally run after the tree becomes terminal. A
        // stale facade used by user cleanup must reject, but that expected
        // rejection is not itself a cleanup failure from dispose()'s caller's
        // perspective. Genuine cleanup errors are still collected below.
        if (getStoreDisposedErrorToken(error) === disposalToken) return
        if (hasError) return
        firstError = error
        hasError = true
    }

    for (const current of tree) {
        // A queued orphan sweep has no external handle to cancel. Drop its
        // roots now; the already-enqueued microtask observes the terminal marker
        // and becomes a no-op. Batched transactions, maxAge timers, onChange,
        // and onCommitEnd own tracked cleanup entries below.
        current.orphanCleanupScheduled = false

        const controllers = takeAbortControllers(current)
        if (controllers) {
            for (const controller of controllers) {
                try {
                    controller.abort()
                } catch (error) {
                    recordError(error)
                }
            }
        }

        // The existing WeakMap carries a compact array of subscribed states.
        // Scope subscriptions drop their parent delegates before their local
        // entry is removed.
        if (Object.hasOwn(current, "subscriptions")) {
            const states = takeStoreSubscriptionStates(current)
            if (states) {
                for (const state of states) {
                    const subscriptions = current.subscriptions.get(state)
                    if (!subscriptions) continue
                    for (const subscription of subscriptions) {
                        try {
                            subscription.reRoot?.()
                        } catch (error) {
                            recordError(error)
                        }
                        try {
                            unsubscribe(state, subscription, current)
                        } catch (error) {
                            recordError(error)
                        }
                    }
                }
            }
        }

        // Drain every registered resource even when an earlier user cleanup
        // throws. The idempotent disposers transfer out of the lifecycle before
        // invocation, so stale cleanup handles are safe.
        const cleanups = takeStoreCleanups(current)
        if (cleanups) {
            for (const cleanup of cleanups) {
                try {
                    cleanup()
                } catch (error) {
                    recordError(error)
                }
            }
        }

        // Subscription teardown normally unmounts the full dependency closure.
        // Keep an explicit iterable mount ledger as the comprehensive backstop
        // for direct/transitive mounts and for cleanup paths that threw early.
        const mounts = takeStoreMounts(current)
        if (mounts) {
            for (const state of mounts) {
                try {
                    unmountAtom(state, current)
                } catch (error) {
                    recordError(error)
                }
            }
        }

        // These are transient scratch owners rather than external resources,
        // but clearing them releases any strong states immediately.
        current.livenessPassActive = false
        current.livenessSeeds = undefined
        current.livenessRemovalArmed = false
        current.livenessLazyArmed = false
    }

    // Defensive counter repair for lifecycle entries created by raw internal
    // callers. Normal registrations are already removed through their tracked
    // disposers above, so these branches are cold and usually empty.
    for (const current of tree) {
        if (current.changeListeners?.size) {
            changeListenerRegistry.count -= current.changeListeners.size
            for (const flags of current.changeListeners.values()) {
                if (flags.selectors) changeListenerRegistry.selectorCount--
            }
            current.changeListeners.clear()
            current.changeListeners = undefined
        }
        if (current.commitEndListeners?.size) {
            commitEndRegistry.count -= current.commitEndListeners.size
            current.commitEndListeners.clear()
            current.commitEndListeners = undefined
        }
        releaseStoreResources(current)
    }

    if (hasError) throw firstError
}
