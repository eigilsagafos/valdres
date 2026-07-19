import type { Atom } from "../types/Atom"
import type { AtomFamilyAtom } from "../types/AtomFamilyAtom"
import type { Family } from "../types/Family"
import type { GetValue } from "../types/GetValue"
import type { SetAtom } from "../types/SetAtom"
import type { State } from "../types/State"
import type { ScopedStore, ScopeFn, Store } from "../types/Store"
import type { StoreData } from "../types/StoreData"
import type { TransactionFn } from "../types/TransactionFn"
import { isAtom } from "../utils/isAtom"
import { isGlobalAtom } from "../utils/isGlobalAtom"
import { isSelector } from "../utils/isSelector"
import { resolveReactive } from "../utils/resolveReactive"
import { unsetValue } from "./unsetValue"
import { createStoreData } from "./createStoreData"
import { deleteFamilyAtom } from "./deleteFamilyAtom"
import { disposeStoreData } from "./disposeStoreData"
import { flushPendingOrphanCleanup } from "./flushPendingOrphanCleanup"
import { getState } from "./getState"
import {
    beginLivenessPass,
    endLivenessPass,
    reconcileLivenessAfterChurn,
} from "./mountAtom"
import { onCommitEnd } from "./onCommitEnd"
import { onStoreChange } from "./onStoreChange"
import { propagateAtomUpdate } from "./propagateUpdatedAtoms"
import { resetAtom } from "./resetAtom"
import { setAtom } from "./setAtom"
import { setValueInData } from "./setValueInData"
import { snapshot } from "./snapshot"
import { STORE_RUNTIME } from "./storeRuntimeKey"
import {
    createStoreDisposedError,
    DISPOSED_STORE_PENDING,
    isPendingStoreLifecycle,
    lifecycleFromPendingStore,
    STORE_LIFECYCLE,
    trackStoreCleanup,
    untrackStoreCleanup,
} from "./storeLifecycle"
import type { StoreLifecycle } from "./storeLifecycle"
import type { PendingStoreLifecycle } from "./storeLifecycle"
import { subscribe } from "./subscribe"
import {
    cancelTransaction,
    commitTransaction,
    transaction,
    TransactionContext,
} from "./transaction"

const SelectorProvidedToSetError = `Invalid state object passed to set().
You provided a \`selector\`.
Only \`atom\` cam be set.
`
const InvalidStateSetError = `Invalid state object passed to set().
Only \`atom\` can be set.
`

/**
 * Lazy maxAge revalidation guard. The maxAge timer (installMaxAgeTimer)
 * is the source of truth for freshness while an atom has subscribers —
 * during that time we leave the cache alone (otherwise we'd undo the
 * stale-while-revalidate window that the timer relies on). When there's
 * no active timer, we drop a cached value past its freshness window so
 * the next read re-evaluates the default.
 *
 * Scope shadows are exempt: a value present in `data.values` for a scoped
 * store is always a deliberate pin from `set()` — the scope never runs
 * its own revalidation timer for maxAge atoms (see subscribe.ts). Evicting
 * the shadow would silently fall back to the parent and defeat the
 * user-visible override.
 */
const isCachedValueStale = (state: State, data: StoreData): boolean => {
    const atom = state as Atom
    const maxAge = atom.maxAge
    if (maxAge === undefined) return false
    if (data.parent) return false
    if (isGlobalAtom(atom)) {
        if (atom.maxAgeInterval !== undefined) return false
    } else {
        const subs = data.subscriptions.get(state)
        if (subs && subs.size > 0) return false
    }
    const lastWrite = data.lastValueWriteAt.get(state)
    if (lastWrite === undefined) return false
    const ttl =
        typeof maxAge === "number" ? maxAge : resolveReactive(maxAge, data)
    return Date.now() - lastWrite > ttl
}

export function storeFromStoreData(
    data: StoreData,
    detach: () => void,
): ScopedStore
export function storeFromStoreData(data: StoreData): Store
export function storeFromStoreData(data: StoreData, detach?: () => void) {
    const runtimeData = data as StoreData & {
        [STORE_RUNTIME]?: Store | PendingStoreLifecycle
    }
    const slot = runtimeData[STORE_RUNTIME]
    let runtime: Store
    if (!slot) {
        runtime = createStoreRuntime(data)
        runtimeData[STORE_RUNTIME] = runtime
    } else if (isPendingStoreLifecycle(slot)) {
        runtime = createStoreRuntime(data, lifecycleFromPendingStore(slot))
        runtimeData[STORE_RUNTIME] = runtime
    } else runtime = slot
    return detach ? createScopeLease(runtime, detach) : runtime
}

/**
 * One facade runtime per StoreData. Besides avoiding a full set of method
 * closures for every scope consumer, this makes the closure-owned init set and
 * implicit transaction authoritative for every handle that reaches the same
 * store data (including the internal handle mountAtom requests).
 */
const createStoreRuntime = (
    data: StoreData,
    initialLifecycle?: StoreLifecycle,
): Store => {
    // Public methods that already flush orphan work reuse that same hot guard
    // for terminal detection. Active stores therefore pay no second branch.
    const _initSet = new Set<Atom>()
    let _initDepth = 0

    // --- Batched mode (implicit transaction) ---
    // When data.batchUpdates is true, sequential store.set() calls within
    // the same microtask are batched into a single transaction whose commit
    // (selector re-evaluation + subscriber notification) is deferred.
    let _pendingTxn: TransactionContext | null = null
    let _pendingTxnCleanup: (() => void) | undefined

    const flushPendingTxn = () => {
        if (data.pendingOrphanCleanup === DISPOSED_STORE_PENDING) {
            _pendingTxn = null
            if (_pendingTxnCleanup) {
                untrackStoreCleanup(data, _pendingTxnCleanup)
                _pendingTxnCleanup = undefined
            }
            return
        }
        if (_pendingTxn) {
            const txnToCommit = _pendingTxn
            _pendingTxn = null
            if (_pendingTxnCleanup) {
                untrackStoreCleanup(data, _pendingTxnCleanup)
                _pendingTxnCleanup = undefined
            }
            commitTransaction(txnToCommit)
        }
    }

    const ensurePendingTxn = () => {
        if (!_pendingTxn) {
            _pendingTxn = new TransactionContext(data)
            const cancelPendingTxn = () => {
                const pendingTxn = _pendingTxn
                _pendingTxn = null
                _pendingTxnCleanup = undefined
                if (pendingTxn) cancelTransaction(pendingTxn)
            }
            _pendingTxnCleanup = trackStoreCleanup(data, cancelPendingTxn)
            queueMicrotask(() => {
                try {
                    flushPendingTxn()
                } catch (error) {
                    // Re-throw asynchronously so the error is observable
                    // (e.g. via window.onerror / process uncaughtException)
                    // without blocking the microtask queue.
                    setTimeout(() => {
                        throw error
                    }, 0)
                }
            })
        }
        return _pendingTxn
    }

    // --- get ---
    const getDefault: GetValue = (state: State) => {
        if (data.pendingOrphanCleanup) {
            if (data.pendingOrphanCleanup === DISPOSED_STORE_PENDING) {
                throw createStoreDisposedError(data)
            }
            flushPendingOrphanCleanup(data)
        }
        // Cold selectors are the only cached states that need to pass through
        // getState for revision validation. Preserve the original atom/active-
        // selector cache-hit path. The eager scalar keeps atom-only stores from
        // touching the lazy cache WeakMap or checking the state object's shape.
        if (data.values.has(state)) {
            const hasColdCache =
                data.coldSelectorCachesEnabled &&
                data.coldSelectorCaches.has(state)
            if (hasColdCache) {
                // No state observed by this cache has changed since its last
                // validation. Return at the store boundary so steady cold
                // reads avoid opening a liveness pass only to collect no seeds.
                const coldCache = data.coldSelectorCaches.get(state)
                if (
                    coldCache?.validatedAt === data.stateRevisionClock.current
                ) {
                    return data.values.get(state)
                }
            } else {
                if (!isCachedValueStale(state, data)) {
                    return data.values.get(state)
                }
                data.values.delete(state)
                data.lastValueWriteAt.delete(state)
            }
        }
        let res
        let initialized = false
        // A read can lazily re-materialize an active selector whose value was
        // dropped (orphan-invalidation, a throwing eval, …), committing new live
        // dependency edges WITHOUT going through propagation's liveness
        // bookkeeping. Own the pass-scoped liveness-seed collector around the
        // read so that re-wire is reconciled from ground-truth reachability
        // afterwards. Cold cache hits also pass through here for revision
        // validation, but they never seed the live graph collector.
        const ownsLivenessSeeds = beginLivenessPass(data)
        let seedsToReconcile: Set<State> | null = null
        _initDepth++
        try {
            res = getState(state, data, _initSet)
        } finally {
            _initDepth--
            // A selector may call another handle for this same StoreData while
            // it is evaluating. Keep every atom initialized by that nested read
            // in the shared set until the outermost get has installed all of its
            // dependency edges; propagating from the nested read would clear the
            // set too early and miss those not-yet-committed edges.
            if (_initDepth === 0 && _initSet.size) {
                const atoms = [..._initSet]
                _initSet.clear()
                propagateAtomUpdate(atoms, data, true)
                initialized = true
            }
            // Release the collector in the finally (a throwing getState/onMount
            // still releases it); reconcile the returned region after the try.
            if (ownsLivenessSeeds) seedsToReconcile = endLivenessPass(data)
        }
        if (seedsToReconcile)
            reconcileLivenessAfterChurn(seedsToReconcile, data)
        // The init-only propagation above walks the dependents of the just-
        // initialized atoms and, for any selector with no live consumer, drops
        // its cached value "for lazy re-eval on next read". When that selector is
        // the very one being read here, that's counterproductive: getState just
        // computed it against the now-materialized atoms, so its value is correct
        // and we want it to stay cached — otherwise every unsubscribed get()
        // re-evaluates and returns a NEW reference, which trips React's "the
        // result of getSnapshot should be cached" warning at initial mount
        // (before useSyncExternalStore establishes its subscription). Restore the
        // freshly-computed value so repeated reads are reference-stable.
        //
        // We restore ONLY the read target. A selector reached merely transitively
        // (e.g. one that read a family whose membership this read just changed) is
        // left invalidated on purpose, so its genuine staleness is picked up on
        // its own next read. (If getState threw, the exception unwinds past this
        // line before it runs, so `res` is never read while undefined.)
        if (initialized && isSelector(state) && !data.values.has(state)) {
            setValueInData(state, res, data)
        }
        return res
    }

    const getBatched: GetValue = (state: State) => {
        if (data.pendingOrphanCleanup) {
            if (data.pendingOrphanCleanup === DISPOSED_STORE_PENDING) {
                throw createStoreDisposedError(data)
            }
            flushPendingOrphanCleanup(data)
        }
        if (_pendingTxn) {
            return _pendingTxn.get(state)
        }
        return getDefault(state)
    }

    const get = data.batchUpdates ? getBatched : getDefault

    // --- set ---
    // @ts-ignore @ts-todo
    const setDefault: SetAtom = (state, value) => {
        if (data.pendingOrphanCleanup) {
            if (data.pendingOrphanCleanup === DISPOSED_STORE_PENDING) {
                throw createStoreDisposedError(data)
            }
            flushPendingOrphanCleanup(data)
        }
        if (isAtom(state)) return setAtom(state, value, data)
        if (isSelector(state)) throw new Error(SelectorProvidedToSetError)
        throw new Error(InvalidStateSetError)
    }

    // @ts-ignore @ts-todo
    const setBatched: SetAtom = (state, value) => {
        if (data.pendingOrphanCleanup) {
            if (data.pendingOrphanCleanup === DISPOSED_STORE_PENDING) {
                throw createStoreDisposedError(data)
            }
            flushPendingOrphanCleanup(data)
        }
        if (isAtom(state)) {
            return ensurePendingTxn().set(state, value)
        }
        if (isSelector(state)) throw new Error(SelectorProvidedToSetError)
        throw new Error(InvalidStateSetError)
    }

    const set = data.batchUpdates ? setBatched : setDefault

    // --- reset ---
    const reset = <V>(atom: Atom<V>) => {
        if (data.pendingOrphanCleanup) {
            if (data.pendingOrphanCleanup === DISPOSED_STORE_PENDING) {
                throw createStoreDisposedError(data)
            }
            flushPendingOrphanCleanup(data)
        }
        if (data.batchUpdates) flushPendingTxn()
        return resetAtom(atom, data)
    }

    // --- del ---
    const del = <
        Value extends unknown,
        Args extends [any, ...any[]] = [any, ...any[]],
    >(
        atom: AtomFamilyAtom<Value, Args>,
    ) => {
        if (data.pendingOrphanCleanup) {
            if (data.pendingOrphanCleanup === DISPOSED_STORE_PENDING) {
                throw createStoreDisposedError(data)
            }
            flushPendingOrphanCleanup(data)
        }
        if (data.batchUpdates) flushPendingTxn()
        return deleteFamilyAtom(atom, data)
    }

    // --- unset ---
    // Drop this store's own value for `atom` so it reverts to what it would
    // otherwise read — the natural inverse of `set`. On a scope the atom
    // re-inherits the parent; on a root it reverts to its default (and is
    // de-materialized, re-initialized lazily on next read — unlike `reset`,
    // which eagerly writes the default back). Distinct from `del` (removes a
    // family member).
    const unset = <V>(atom: Atom<V>) => {
        if (data.pendingOrphanCleanup) {
            if (data.pendingOrphanCleanup === DISPOSED_STORE_PENDING) {
                throw createStoreDisposedError(data)
            }
            flushPendingOrphanCleanup(data)
        }
        if (data.batchUpdates) flushPendingTxn()
        return unsetValue(atom, data)
    }

    const sub = <V>(
        state: State<V> | Family<V, any>,
        callback: () => void,
        deepEqualCheckBeforeCallback: boolean = true,
    ) => {
        return subscribe(state, callback, deepEqualCheckBeforeCallback, data)
    }

    const txn = (callback: TransactionFn, name?: string) => {
        if (data.pendingOrphanCleanup) {
            if (data.pendingOrphanCleanup === DISPOSED_STORE_PENDING) {
                throw createStoreDisposedError(data)
            }
            flushPendingOrphanCleanup(data)
        }
        if (data.batchUpdates) flushPendingTxn()
        return transaction(callback, data, name)
    }

    // Implementation signature is permissive; the precise per-option callback
    // types live on the overloaded `Store["onChange"]`, which this satisfies.
    const onChange = ((
        callback: any,
        options?: { atoms?: boolean; selectors?: boolean },
    ) => {
        if (data.pendingOrphanCleanup === DISPOSED_STORE_PENDING) {
            throw createStoreDisposedError(data)
        }
        return onStoreChange(callback, data, options)
    }) as Store["onChange"]

    const storeOnCommitEnd = (callback: () => void) => {
        if (data.pendingOrphanCleanup === DISPOSED_STORE_PENDING) {
            throw createStoreDisposedError(data)
        }
        return onCommitEnd(callback, data)
    }

    const storeSnapshot = () => {
        if (data.pendingOrphanCleanup) {
            if (data.pendingOrphanCleanup === DISPOSED_STORE_PENDING) {
                throw createStoreDisposedError(data)
            }
            flushPendingOrphanCleanup(data)
        }
        return snapshot(data)
    }

    const dispose = () => {
        if (data.pendingOrphanCleanup === DISPOSED_STORE_PENDING) return
        disposeStoreData(data)
    }

    const scope: ScopeFn = ((scopeId: string, callback?: any) => {
        if (data.pendingOrphanCleanup) {
            if (data.pendingOrphanCleanup === DISPOSED_STORE_PENDING) {
                throw createStoreDisposedError(data)
            }
            flushPendingOrphanCleanup(data)
        }
        if (callback) {
            if (!data.scopes.has(scopeId)) {
                throw new Error(`Scope ${scopeId} does not exist`)
            }
            const scopedStoreData = data.scopes.get(scopeId)!
            const scopedStore = storeFromStoreData(
                scopedStoreData,
            ) as ScopedStore
            const res = callback(scopedStore)
            return res
        } else {
            let scopedStoreData
            if (data.scopes.has(scopeId)) {
                scopedStoreData = data.scopes.get(scopeId)!
            } else {
                // schemaValidation and enumerable are inherited from the parent
                // inside createStoreData; only batchUpdates needs forwarding here.
                const scopeOptions = data.batchUpdates
                    ? { batchUpdates: true }
                    : undefined
                scopedStoreData = createStoreData(scopeId, data, scopeOptions)
                data.scopes.set(scopeId, scopedStoreData)
            }
            const consumers = scopedStoreData.scopeConsumers!
            const detach = (expectedToDestroy = false) => {
                consumers.delete(detach)
                if (consumers.size === 0) {
                    disposeStoreData(scopedStoreData)
                    return true
                }
                if (expectedToDestroy) {
                    console.warn(
                        `Scope ${scopeId} still has ${consumers.size} consumers, will not detach`,
                    )
                }
                return false
            }

            consumers.add(detach)
            const newStore = storeFromStoreData(
                data.scopes.get(scopeId)!,
                detach,
            )
            return newStore
        }
    }) as ScopeFn

    const runtime = {
        get,
        set,
        sub,
        txn,
        reset,
        del,
        unset,
        data,
        scope,
        onChange,
        onCommitEnd: storeOnCommitEnd,
        snapshot: storeSnapshot,
        dispose,
    } as Store & { [STORE_LIFECYCLE]?: StoreLifecycle }
    // The ordinary facade carries no lifecycle property. Add the slot only
    // when raw StoreData acquired resources before its canonical facade
    // existed; later lifecycle work remains a cold, one-time shape transition.
    if (initialLifecycle !== undefined) {
        runtime[STORE_LIFECYCLE] = initialLifecycle
    }
    return runtime
}

/** A scope consumer owns only its detach lease; all operations share runtime. */
const createScopeLease = (runtime: Store, detach: () => void): ScopedStore => ({
    get: runtime.get,
    set: runtime.set,
    sub: runtime.sub,
    txn: runtime.txn,
    reset: runtime.reset,
    del: runtime.del,
    unset: runtime.unset,
    data: runtime.data,
    scope: runtime.scope,
    onChange: runtime.onChange,
    onCommitEnd: runtime.onCommitEnd,
    snapshot: runtime.snapshot,
    dispose: detach,
    detach,
})
