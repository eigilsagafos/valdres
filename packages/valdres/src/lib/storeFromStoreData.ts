import type { Atom } from "../types/Atom"
import type { AtomFamilyAtom } from "../types/AtomFamilyAtom"
import type { Family } from "../types/Family"
import type { GetValue } from "../types/GetValue"
import type { SetAtom } from "../types/SetAtom"
import type { State } from "../types/State"
import type { ScopedStore, ScopeFn, Store } from "../types/Store"
import type { ScopedStoreData, StoreData } from "../types/StoreData"
import type { TransactionFn } from "../types/TransactionFn"
import { isAtom } from "../utils/isAtom"
import { isSelector } from "../utils/isSelector"
import { createStoreData } from "./createStoreData"
import { deleteFamilyAtom } from "./deleteFamilyAtom"
import { getState } from "./getState"
import { propagateUpdatedAtoms } from "./propagateUpdatedAtoms"
import { resetAtom } from "./resetAtom"
import { setAtom } from "./setAtom"
import { subscribe } from "./subscribe"
import { Transaction, transaction } from "./transaction"

const SelectorProvidedToSetError = `Invalid state object passed to set().
You provided a \`selector\`.
Only \`atom\` cam be set.
`
const InvalidStateSetError = `Invalid state object passed to set().
Only \`atom\` can be set.
`

export function storeFromStoreData(
    data: ScopedStoreData,
    detach: () => void,
): ScopedStore
export function storeFromStoreData(data: StoreData): Store
export function storeFromStoreData(
    data: ScopedStoreData | StoreData,
    detach?: () => void,
) {
    const _initSet = new Set<Atom>()

    // --- Batched mode (implicit transaction) ---
    // When data.batchUpdates is true, sequential store.set() calls within
    // the same microtask are batched into a single transaction whose commit
    // (selector re-evaluation + subscriber notification) is deferred.
    let _pendingTxn: Transaction | null = null

    const flushPendingTxn = () => {
        if (_pendingTxn) {
            const txnToCommit = _pendingTxn
            _pendingTxn = null
            txnToCommit.commit()
        }
    }

    const ensurePendingTxn = () => {
        if (!_pendingTxn) {
            _pendingTxn = new Transaction(data)
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
        if (data.values.has(state)) return data.values.get(state)
        let res
        try {
            res = getState(state, data, _initSet)
        } finally {
            if (_initSet.size) {
                const atoms = [..._initSet]
                _initSet.clear()
                propagateUpdatedAtoms(atoms, data, undefined, undefined, false, undefined, false, true)
            }
        }
        return res
    }

    const getBatched: GetValue = (state: State) => {
        if (_pendingTxn) {
            return _pendingTxn.get(state)
        }
        return getDefault(state)
    }

    const get = data.batchUpdates ? getBatched : getDefault

    // --- set ---
    // @ts-ignore @ts-todo
    const setDefault: SetAtom = (state, value) => {
        if (isAtom(state)) return setAtom(state, value, data)
        if (isSelector(state)) throw new Error(SelectorProvidedToSetError)
        throw new Error(InvalidStateSetError)
    }

    // @ts-ignore @ts-todo
    const setBatched: SetAtom = (state, value) => {
        if (isAtom(state)) {
            return ensurePendingTxn().set(state, value)
        }
        if (isSelector(state)) throw new Error(SelectorProvidedToSetError)
        throw new Error(InvalidStateSetError)
    }

    const set = data.batchUpdates ? setBatched : setDefault

    // --- reset ---
    const reset = <V>(atom: Atom<V>) => {
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
        if (data.batchUpdates) flushPendingTxn()
        return deleteFamilyAtom(atom, data)
    }

    const sub = <V>(
        state: State<V> | Family<V, any>,
        callback: () => void,
        deepEqualCheckBeforeCallback: boolean = true,
    ) => subscribe(state, callback, deepEqualCheckBeforeCallback, data)

    const txn = (callback: TransactionFn) => {
        if (data.batchUpdates) flushPendingTxn()
        return transaction(callback, data)
    }

    const scope: ScopeFn = ((scopeId: string, callback?: any) => {
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
                scopedStoreData = createStoreData(scopeId, data, data.batchUpdates ? { batchUpdates: true } : undefined)
                data.scopes.set(scopeId, scopedStoreData)
            }
            const detach = (expectedToDestory = false) => {
                scopedStoreData.scopeConsumers.delete(detach)
                if (scopedStoreData.scopeConsumers.size === 0) {
                    if (expectedToDestory) {
                        console.log("Deleting scope", scopeId)
                    }
                    data.scopes.delete(scopeId)
                    return true
                }
                if (expectedToDestory) {
                    console.warn(
                        `Scope ${scopeId} still has ${scopedStoreData.scopeConsumers.size} consumers, will not detach`,
                    )
                }
                return false
            }

            scopedStoreData.scopeConsumers.add(detach)
            const newStore = storeFromStoreData(data.scopes.get(scopeId)!, detach)
            return newStore
        }
    }) as ScopeFn

    if (detach) {
        return {
            get,
            set,
            sub,
            txn,
            reset,
            del,
            data,
            scope,
            detach,
        } as ScopedStore
    } else {
        return {
            get,
            set,
            sub,
            txn,
            reset,
            del,
            data,
            scope,
        } as Store
    }
}
