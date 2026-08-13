import type { Atom } from "../types/Atom"
import type { AtomFamilyAtom } from "../types/AtomFamilyAtom"
import type { GetValue } from "../types/GetValue"
import type { SetAtom } from "../types/SetAtom"
import type { State } from "../types/State"
import type { ScopedStore, ScopeFn, Store } from "../types/Store"
import type { StoreData } from "../types/StoreData"
import type { TransactionFn } from "../types/TransactionFn"
import { isAtom } from "../utils/isAtom"
import { isSelector } from "../utils/isSelector"
import { cacheController } from "./cacheController"
import { unsetValue } from "./unsetValue"
import { createStoreData } from "./createStoreData"
import { deleteFamilyAtom } from "./deleteFamilyAtom"
import { disposeStoreData } from "./disposeStoreData"
import {
    beginLivenessPass,
    endLivenessPass,
    flushPendingOrphanCleanup,
    reconcileLivenessAfterChurn,
} from "./graph"
import { getState } from "./getState"
import { onCommitEnd } from "./onCommitEnd"
import { onStoreChange } from "./onStoreChange"
import { SETTLE_INIT_ONLY } from "./commitIntents"
import { settleCommit } from "./propagateUpdatedAtoms"
import { resetAtom } from "./resetAtom"
import { setAtom } from "./setAtom"
import { setValueInData } from "./setValueInData"
import { snapshot } from "./snapshot"
import { STORE_DATA_ACCESS } from "./storeDataAccessToken"
import { BORROWED_STORE_RUNTIME, STORE_RUNTIME } from "./storeRuntimeKey"
import {
    createStoreDisposedError,
    DISPOSED_STORE_PENDING,
    trackStoreCleanup,
    untrackStoreCleanup,
} from "./storeLifecycle"
import { subscribe } from "./subscribe"
import {
    cancelTransaction,
    commitTransaction,
    transaction,
    TransactionContext,
} from "./transaction"
import { stateNameSuffix } from "./stateNameForError"

const transactionForStore = (
    transaction: TransactionContext,
    data: StoreData,
): TransactionContext =>
    data.parent
        ? transactionForStore(transaction, data.parent).scopedTransaction(
              data.id,
          )
        : transaction

const selectorProvidedToSetError = (
    state: unknown,
) => `valdres: invalid state object${stateNameSuffix(state)} passed to set().
You provided a \`selector\`.
Only an \`atom\` can be set.
`
const invalidStateSetError = (
    state: unknown,
) => `valdres: invalid state object${stateNameSuffix(state)} passed to set().
Only an \`atom\` can be set.
`

export function storeFromStoreData(
    data: StoreData,
    detach: () => void,
): ScopedStore
export function storeFromStoreData(data: StoreData): Store
export function storeFromStoreData(data: StoreData, detach?: () => void) {
    const runtimeData = data as StoreData & { [STORE_RUNTIME]?: Store }
    let runtime = runtimeData[STORE_RUNTIME]
    if (!runtime) {
        runtime = createStoreRuntime(data)
        runtimeData[STORE_RUNTIME] = runtime
    }
    return detach ? createScopeLease(runtime, detach) : runtime
}

const borrowedStoreFromStoreData = (
    data: StoreData,
): Omit<Store, "dispose"> => {
    const runtimeData = data as StoreData & {
        [BORROWED_STORE_RUNTIME]?: Omit<Store, "dispose">
    }
    let borrowed = runtimeData[BORROWED_STORE_RUNTIME]
    if (!borrowed) {
        const { dispose: _, ...borrowedRuntime } = storeFromStoreData(data)
        borrowed = borrowedRuntime
        runtimeData[BORROWED_STORE_RUNTIME] = borrowed
    }
    return borrowed
}

/**
 * One facade runtime per StoreData. Besides avoiding a full set of method
 * closures for every scope consumer, this makes the closure-owned init set and
 * implicit transaction authoritative for every handle that reaches the same
 * store data (including the internal handle mountAtom requests).
 */
const createStoreRuntime = (data: StoreData): Store => {
    // Public methods that already flush orphan work reuse that same hot guard
    // for terminal detection. Active stores therefore pay no second branch.
    const _initSet = new Set<Atom>()
    let _initDepth = 0

    // --- Batched mode (implicit transaction) ---
    // When data.batchUpdates is true, sequential store.set() calls within
    // the same microtask are batched into a single transaction whose commit
    // (selector re-evaluation + subscriber notification) is deferred.
    let _pendingTxn: TransactionContext | null = null

    const currentPendingTransaction = () => {
        // @ts-expect-error Store batching and transactions are one internal unit.
        if (_pendingTxn?._state) _pendingTxn = null
        return _pendingTxn
    }

    const borrowPendingTransaction = (rootTxn: TransactionContext) => {
        const linkedTxn = transactionForStore(rootTxn, data)
        _pendingTxn = linkedTxn
        // currentPendingTransaction() drops a closed pointer on the next call,
        // but an idle scope may never be called again. Release after the owner's
        // already-queued commit so the closed transaction tree is not retained.
        queueMicrotask(() => {
            if (_pendingTxn === linkedTxn) _pendingTxn = null
        })
        return linkedTxn
    }

    const flushBatchTransaction = () => {
        const pendingTxn = data.tree.pendingBatch
        if (pendingTxn) {
            const tree = data.tree
            tree.pendingBatch = null
            if (tree.pendingBatchCleanup) {
                untrackStoreCleanup(tree.root, tree.pendingBatchCleanup)
                tree.pendingBatchCleanup = undefined
            }
            commitTransaction(pendingTxn)
        }
    }

    const flushPendingTxn = () => {
        if (data.pendingOrphanCleanup === DISPOSED_STORE_PENDING) {
            _pendingTxn = null
            return
        }
        flushBatchTransaction()
    }

    const ensureBatchTransaction = () => {
        let pendingTxn = data.tree.pendingBatch
        if (!pendingTxn) {
            const tree = data.tree
            pendingTxn = new TransactionContext(tree.root)
            // @ts-expect-error Store batching and transactions are one internal unit.
            pendingTxn._implicitBatch = true
            const cancelPendingTxn = () => {
                const pendingTxn = tree.pendingBatch
                tree.pendingBatch = null
                tree.pendingBatchCleanup = undefined
                if (pendingTxn) cancelTransaction(pendingTxn)
            }
            tree.pendingBatch = pendingTxn
            tree.pendingBatchCleanup = trackStoreCleanup(
                tree.root,
                cancelPendingTxn,
            )
            queueMicrotask(() => {
                try {
                    flushBatchTransaction()
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
        return pendingTxn
    }

    const ensurePendingTxn = () =>
        currentPendingTransaction() ??
        borrowPendingTransaction(ensureBatchTransaction())

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
                if (coldCache?.validatedAt === data.tree.revision) {
                    return data.values.get(state)
                }
            } else {
                // Keep ordinary cached reads off the controller module. The
                // property check replaces the one expireIfStale would perform,
                // but avoids its cross-module call for every non-cache state.
                if (
                    (state as Atom).maxAge === undefined ||
                    !cacheController.expireIfStale(state, data)
                ) {
                    return data.values.get(state)
                }
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
                settleCommit(
                    atoms,
                    data,
                    undefined,
                    undefined,
                    SETTLE_INIT_ONLY,
                )
                initialized = true
            }
            // Release the collector in the finally (a throwing getState/onMount
            // still releases it); reconcile the returned region after the try.
            if (ownsLivenessSeeds) seedsToReconcile = endLivenessPass(data)
        }
        // OWNER-DEFERRED reconciliation, same mode as propagateSelectorUpdates:
        // a read nested inside an in-flight pass defers its seeds to that owner
        // and gets null back here. (unsubscribe.ts is the IMMEDIATE mode — see
        // the two-calling-modes note on reconcileLivenessAfterChurn.)
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
        const pendingTxn = currentPendingTransaction()
        if (pendingTxn) return pendingTxn.get(state)
        const batchTxn = data.tree.pendingBatch
        if (batchTxn) return borrowPendingTransaction(batchTxn).get(state)
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
        if (isSelector(state))
            throw new Error(selectorProvidedToSetError(state))
        throw new Error(invalidStateSetError(state))
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
        if (isSelector(state))
            throw new Error(selectorProvidedToSetError(state))
        throw new Error(invalidStateSetError(state))
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
        state: State<V>,
        callback: (...args: any[]) => void,
        deepEqualCheckBeforeCallback: boolean = true,
    ) => {
        return subscribe(state, callback, deepEqualCheckBeforeCallback, data)
    }

    const txn = (
        callback: TransactionFn | typeof STORE_DATA_ACCESS,
        name?: string,
    ) => {
        // Adapter-only closure handshake. The token is not reachable from the
        // public facade or package root, so StoreData never becomes a runtime
        // property and ordinary store creation needs no side registry.
        if (callback === STORE_DATA_ACCESS) return data
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

    const scope: ScopeFn = ((
        scopeId: string,
        callback?: (store: Omit<Store, "dispose">) => unknown,
    ) => {
        if (data.pendingOrphanCleanup) {
            if (data.pendingOrphanCleanup === DISPOSED_STORE_PENDING) {
                throw createStoreDisposedError(data)
            }
            flushPendingOrphanCleanup(data)
        }
        if (callback) {
            const scopedStoreData = data.scopes.get(scopeId)
            if (scopedStoreData === undefined) {
                throw new Error(`valdres: scope '${scopeId}' does not exist`)
            }
            const scopedStore = borrowedStoreFromStoreData(scopedStoreData)
            return callback(scopedStore)
        } else {
            // Scope maps contain StoreData only, so undefined unambiguously
            // means absence; state values are never consulted here.
            let scopedStoreData = data.scopes.get(scopeId)
            if (scopedStoreData === undefined) {
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
            const newStore = storeFromStoreData(scopedStoreData, detach)
            return newStore
        }
    }) as ScopeFn

    const runtime = {
        id: data.id,
        get,
        set,
        sub,
        txn,
        reset,
        del,
        unset,
        scope,
        onChange,
        onCommitEnd: storeOnCommitEnd,
        snapshot: storeSnapshot,
        dispose,
    }
    // The facade carries no internal state at all: lifecycle resources live in
    // StoreData.resources, so nothing here ever changes shape.
    return runtime
}

/** A scope consumer owns only its detach lease; all operations share runtime. */
const createScopeLease = (runtime: Store, detach: () => void): ScopedStore => {
    const lease: ScopedStore = {
        id: runtime.id,
        get: runtime.get,
        set: runtime.set,
        sub: runtime.sub,
        txn: runtime.txn,
        reset: runtime.reset,
        del: runtime.del,
        unset: runtime.unset,
        scope: runtime.scope,
        onChange: runtime.onChange,
        onCommitEnd: runtime.onCommitEnd,
        snapshot: runtime.snapshot,
        dispose: detach,
        detach,
    }
    return lease
}
