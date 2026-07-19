import type { GlobalAtom } from "../types/GlobalAtom"
import type { StoreData } from "../types/StoreData"
import { detachInheritedDependencyBranches } from "./inheritedDependencyBranches"
import { deleteMaxAgeCleanup, getMaxAgeCleanup } from "./maxAgeCleanups"
import { unmountAtom } from "./mountAtom"
import { getTouchedGlobals, markStoreDisposed } from "./storeLifecycle"

type StoreGlobals = [StoreData, GlobalAtom<any>[]]

/**
 * Dispose one store tree in time proportional to its scopes and touched global
 * atoms. Global registrations are removed before user cleanup runs, so a
 * throwing cleanup cannot leave a store retained or in future fan-out paths.
 */
export const disposeStoreData = (data: StoreData): void => {
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
        markStoreDisposed(current)

        // Unlink scopes while their scopeIndexKeys are still available. This is
        // also what the ref-counted ScopedStore.detach() path needs to release.
        const parent = current.parent
        if (parent) {
            detachInheritedDependencyBranches(current, current === data)
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
        if (hasError) return
        firstError = error
        hasError = true
    }

    // Balance global maxAge and onMount lifecycles for stores disposed while
    // still subscribed. Both helpers are idempotent, so later unsubscribe calls
    // become harmless no-ops for these resources.
    for (const [current, globals] of globalsByStore) {
        for (const atom of globals) {
            const maxAgeCleanup = getMaxAgeCleanup(current, atom)
            if (maxAgeCleanup) {
                try {
                    maxAgeCleanup()
                } catch (error) {
                    recordError(error)
                } finally {
                    deleteMaxAgeCleanup(current, atom)
                }
            }
            try {
                unmountAtom(atom, current)
            } catch (error) {
                recordError(error)
            }
        }
    }

    if (hasError) throw firstError
}
