import type { State } from "../../types/State"
import type { StoreData } from "../../types/StoreData"
import { isPromiseLike } from "../../utils/isPromiseLike"
import { isStoreDisposed } from "../storeLifecycle"
import { cleanupOrphanedDeps } from "./cleanupOrphanedDeps"
import { isLive } from "./mountAtom"

/**
 * A framework snapshot read catches a cold graph up speculatively before its
 * subscription is installed. If the render is abandoned this queue restores
 * the ordinary cold shape on the next microtask; if it commits, the subscription
 * makes the root live and cleanup becomes a no-op. Suspended observations retain
 * their region until the current Promise settles so a retry remains resumable.
 *
 * This is deliberately separate from `pendingOrphanCleanup`. Public store
 * operations flush that queue synchronously to preserve unsubscribe semantics,
 * while an observed graph is a coherent active graph and must survive the
 * repeated getSnapshot calls that precede React's subscribe call.
 */
type ObservedRegion = {
    states: Set<State>
    waitingOn?: Promise<unknown>
}

// Keep detached nodes associated with the root whose observation activated
// them. A suspended root must retain its whole evaluation graph until its
// current Promise settles; flattening all roots into one Set would either tear
// that graph down too early or make an unrelated never-settling root retain
// every abandoned observation in the store.
const pendingObservedCleanup = new WeakMap<
    StoreData,
    Map<State, ObservedRegion>
>()
const observedCleanupScheduled = new WeakSet<StoreData>()
// A Promise remains thenable after settlement, so shape alone cannot tell a
// later cleanup pass that React no longer needs its provisional graph. Keep the
// settlement bit weakly on the Promise identity; neither the Promise nor its
// selector graph is retained by this table.
const settledObservedPromises = new WeakSet<WeakKey>()

/** Protect the active dependency closure a suspended render must retry. This
 * is intentionally derived from the current graph instead of `region.states`:
 * a fresh observation queues only its root, and multiple observed roots can
 * share an already-active dependency that belongs to another region. */
const protectObservedClosure = (
    root: State,
    data: StoreData,
    protectedStates: WeakSet<WeakKey>,
) => {
    const stack = [root]
    while (stack.length > 0) {
        const current = stack.pop()!
        if (protectedStates.has(current)) continue
        protectedStates.add(current)
        const dependencies = data.stateDependencies.get(current)
        if (!dependencies) continue
        for (const dependency of dependencies) stack.push(dependency)
    }
}

/** Install settlement reactions outside the cleanup microtask's activation.
 * JavaScriptCore retains a reaction closure's whole lexical environment, not
 * only the bindings named by its body. Keeping this helper at module scope
 * prevents an externally retained, never-settling Promise from retaining the
 * cleanup turn's `data` and `regions` through that environment. */
const waitForObservedPromise = (
    current: Promise<unknown>,
    dataRef: WeakRef<StoreData>,
) => {
    const settled = () => {
        settledObservedPromises.add(current)
        const retainedData = dataRef.deref()
        if (retainedData) scheduleObservedCleanup(retainedData)
    }
    Promise.resolve(current).then(settled, settled)
}

const scheduleObservedCleanup = (data: StoreData) => {
    if (!observedCleanupScheduled.has(data)) {
        observedCleanupScheduled.add(data)
        queueMicrotask(() => {
            observedCleanupScheduled.delete(data)
            const regions = pendingObservedCleanup.get(data)
            if (!regions) return
            if (isStoreDisposed(data)) {
                pendingObservedCleanup.delete(data)
                return
            }

            // Classify every retained Promise before cleaning any abandoned
            // sibling. Orphan cleanup walks both dependencies and dependents,
            // so processing regions one at a time can otherwise cross a shared
            // dependency and revoke a suspended root that appears later here.
            let protectedRoots: WeakSet<WeakKey> | undefined
            let protectedStates: WeakSet<WeakKey> | undefined
            for (const [root, region] of regions) {
                const current = data.values.get(root)
                if (
                    !isLive(root, data) &&
                    isPromiseLike(current) &&
                    !settledObservedPromises.has(current)
                ) {
                    protectedRoots ??= new WeakSet()
                    protectedRoots.add(root)
                    protectedStates ??= new WeakSet()
                    protectObservedClosure(root, data, protectedStates)
                    // React cannot install useSyncExternalStore's subscription
                    // while this snapshot is suspended. Revoking the pending
                    // evaluation here would make the retry create a different
                    // Promise and leave React waiting forever. Preserve the
                    // provisional region and retry cleanup after whichever
                    // Promise is current has settled. A re-evaluation may swap
                    // in another Promise, which the next pass observes and
                    // waits for in turn.
                    if (region.waitingOn !== current) {
                        region.waitingOn = current
                        // A user-owned, never-settling Promise may outlive a
                        // disposed store. Its reactions therefore retain only
                        // a WeakRef to StoreData, never the store itself or the
                        // region's strongly held states.
                        waitForObservedPromise(current, new WeakRef(data))
                    }
                }
            }

            for (const [root, region] of regions) {
                if (protectedRoots?.has(root)) continue
                regions.delete(root)
                for (const state of region.states) {
                    cleanupOrphanedDeps(state, data, protectedStates)
                }
            }
            if (regions.size === 0) pendingObservedCleanup.delete(data)
        })
    }
}

const regionFor = (root: State, data: StoreData) => {
    if (isStoreDisposed(data)) return

    let pending = pendingObservedCleanup.get(data)
    if (!pending) {
        pending = new Map()
        pendingObservedCleanup.set(data, pending)
    }
    let region = pending.get(root)
    if (!region) {
        region = { states: new Set() }
        pending.set(root, region)
    }
    scheduleObservedCleanup(data)
    return region
}

export const queueObservedCleanup = (state: State, data: StoreData) => {
    regionFor(state, data)?.states.add(state)
}

/** Queue every node from an old closure; dynamic evaluation can detach one of
 * them from the subscribing root before the cleanup microtask can reach it. */
export const queueObservedCleanups = (
    root: State,
    states: readonly State[],
    data: StoreData,
) => {
    const region = regionFor(root, data)
    if (!region) return
    for (const state of states) region.states.add(state)
    region.states.add(root)
}

/** Release provisional observations during terminal store disposal. Ordinary
 * cleanup demotes committed selectors back to cold caches; a disposed store
 * instead drops their graph/value entries so no terminal reverse edges remain.
 * Any already-enqueued microtask sees the missing map and becomes a no-op. */
export const dropObservedCleanups = (data: StoreData) => {
    const regions = pendingObservedCleanup.get(data)
    pendingObservedCleanup.delete(data)
    observedCleanupScheduled.delete(data)
    if (!regions) return

    for (const region of regions.values()) {
        for (const state of region.states) {
            cleanupOrphanedDeps(state, data, undefined, true)
        }
    }
}
