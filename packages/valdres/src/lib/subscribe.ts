import type { Atom } from "../types/Atom"
import type { State } from "../types/State"
import type { StoreData } from "../types/StoreData"
import type { Subscription } from "../types/Subscription"
import { isAtom } from "../utils/isAtom"
import { isAtomFamily } from "../utils/isAtomFamily"
import { isFamilyAtom } from "../utils/isFamilyAtom"
import { isSelector } from "../utils/isSelector"
import { cacheController } from "./cacheController"
import { SETTLE_INIT_ONLY } from "./commitIntents"
import { initAtom } from "./initAtom"
import { initFreshActiveSelector } from "./initSelector"
import { getState } from "./getState"
import { settleCommit } from "./propagateUpdatedAtoms"
import { mountTransitiveDeps, onFirstDirectSubscriber } from "./graph"
import {
    createStoreDisposedError,
    DISPOSED_STORE_PENDING,
} from "./storeLifecycle"
import { addSubscriptionEqualCheck, unsubscribe } from "./unsubscribe"

const initSubscribers = <V>(state: State<V>, data: StoreData) => {
    const set = new Set<Subscription>()
    data.subscriptions.set(state, set)
    return set
}

export const subscribe = <V>(
    state: State<V>,
    callback: (...args: any[]) => void,
    requireDeepEqualCheckBeforeCallback: boolean,
    data: StoreData,
) => {
    if (data.pendingOrphanCleanup === DISPOSED_STORE_PENDING) {
        throw createStoreDisposedError(data)
    }
    // Classify once. Besides rejecting selector-family factory objects at the
    // runtime boundary, this avoids repeating Object.hasOwn checks throughout
    // the subscription setup hot path.
    const atomState = isAtom(state)
    const atomFamilyState = !atomState && isAtomFamily(state)
    const selectorState = !atomState && !atomFamilyState && isSelector(state)
    if (!atomState && !atomFamilyState && !selectorState) {
        throw new Error("Invalid object passed to sub")
    }
    let parentUnsubscribe: undefined | (() => void)
    let dropDelegate: undefined | (() => void)
    let reDelegate: undefined | (() => void)
    if (data.parent && (atomState || atomFamilyState)) {
        /**
         * Getting here means that we are within a scope subscribing to an atom
         * (or a family, which always reads through). While the scope does not
         * shadow the atom we delegate the subscription up the tree, modifying
         * the callback to drop the delegate if the scope later shadows it. We
         * keep the delegation machinery even when the atom is currently shadowed
         * so `unset` can re-establish the delegate when the shadow is dropped.
         */
        const originalCallback = callback
        const delegateToParent = () =>
            subscribe(
                state,
                originalCallback,
                requireDeepEqualCheckBeforeCallback,
                data.parent!,
            )
        // A family always reads through (no own value); an atom delegates only
        // while this scope does not shadow it.
        if (atomFamilyState || !data.values.has(state)) {
            parentUnsubscribe = delegateToParent()
        }
        // Idempotent: once the scope re-roots the subscription, the parent-side
        // delegate must drop so we don't double-notify on later writes. This
        // fires either lazily (first scope-local propagation, below) or eagerly
        // (when the scope shadows the state — see setValueInData), whichever
        // comes first.
        dropDelegate = () => {
            if (parentUnsubscribe) {
                parentUnsubscribe()
                parentUnsubscribe = undefined
            }
        }
        // Inverse of dropDelegate: re-establish the parent delegate. Idempotent.
        // Mutates the same `parentUnsubscribe` cell that the returned unsubscribe
        // closure reads, so a re-delegated subscription is still torn down
        // correctly on unsubscribe.
        reDelegate = () => {
            if (!parentUnsubscribe) {
                parentUnsubscribe = delegateToParent()
            }
        }
        callback = atomFamilyState
            ? (...args) => {
                  dropDelegate!()
                  originalCallback(...args)
              }
            : () => {
                  dropDelegate!()
                  originalCallback()
              }
    } else if (!data.values.has(state) && atomState) {
        const initializedAtomsSet = new Set<Atom>()
        initAtom(state, data, initializedAtomsSet)
        if (initializedAtomsSet.size) {
            initializedAtomsSet.add(state)
            settleCommit(
                [...initializedAtomsSet],
                data,
                undefined,
                undefined,
                SETTLE_INIT_ONLY,
            )
        } else if (isFamilyAtom(state)) {
            settleCommit([state], data, undefined, undefined, SETTLE_INIT_ONLY)
        }
    }
    // A selector may have a revision-validated cold cache. Read through
    // getState even on a cache hit so a stale dynamic dependency set is rebuilt
    // before the first subscriber promotes it into the live reverse graph.
    if (selectorState) {
        const selectorHasValue = data.values.has(state)
        // With no value or dependency set there is nothing cold to validate.
        // Check this dominant fresh-subscription shape before touching the
        // active-marker WeakSet.
        if (!selectorHasValue && !data.stateDependencies.has(state)) {
            initFreshActiveSelector(state, data, new Set(), new WeakSet())
        } else if (
            !selectorHasValue ||
            (data.coldSelectorCachesEnabled &&
                !data.selectorGraphActive.has(state))
        ) {
            // Existing cold caches must validate before promotion; an active
            // selector whose value was dropped must re-evaluate in graph mode.
            getState(state, data, new Set(), new WeakSet())
        }
    }

    const subscribers =
        data.subscriptions.get(state) || initSubscribers(state, data)

    let subscription
    if (atomFamilyState) {
        subscription = {
            callback,
            state,
            requireDeepEqualCheckBeforeCallback,
            reRoot: dropDelegate,
            reDelegate,
        }
    } else {
        subscription = {
            callback,
            requireDeepEqualCheckBeforeCallback,
            reRoot: dropDelegate,
            reDelegate,
        }
    }
    subscribers.add(subscription)
    // This public equality table also serves as disposal's iterable active-state
    // index. Equality counts live on the subscriber Set, so the map remains one
    // O(1) write per state transition rather than a second bookkeeping structure.
    if (subscribers.size === 1 && !requireDeepEqualCheckBeforeCallback) {
        data.subscriptionsRequireEqualCheck.set(state, undefined)
    }
    if (requireDeepEqualCheckBeforeCallback) {
        addSubscriptionEqualCheck(state, subscribers, data)
    }
    const unsubscribeSubscription = () => {
        if (!parentUnsubscribe) {
            unsubscribe(state, subscription, data)
            return
        }
        // A delegated parent cleanup is user code and may throw. The local
        // subscription still has to unwind in that case.
        try {
            parentUnsubscribe()
        } finally {
            unsubscribe(state, subscription, data)
        }
    }
    if (subscribers.size === 1) {
        try {
            // Skip scope-local controller retention: reaching the non-delegating
            // branch in a scope means the atom was shadowed via `set()`, which
            // we treat as a deliberate pin. Running an extra timer here would
            // overwrite the shadow on the next tick and double the work for
            // non-global maxAge atoms (which lack the refCount sharing used by
            // global cache controllers).
            if (atomState && state.maxAge !== undefined && !data.parent) {
                cacheController.retain(state, data, subscribe)
            }
            // First direct subscriber: bump liveness through the dep graph.
            // Selectors track this via stateDependencies; families have none.
            if (!atomFamilyState) {
                // First direct subscriber is an ADDITIVE liveness change — the
                // incremental walk is correct here, including through cycles (each
                // live dependent is counted once; the prev===0 guard visits each
                // node the single time it flips live). Deps built lazily via get()
                // after this subscribe are reconciled by getDefault's own pass.
                onFirstDirectSubscriber(state as State, data)
                mountTransitiveDeps(state, data)
            }
        } catch (error) {
            // Preserve the mount error if rollback encounters a secondary
            // cleanup error.
            try {
                unsubscribeSubscription()
            } catch {}
            throw error
        }
    }

    return unsubscribeSubscription
}
