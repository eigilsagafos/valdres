import { getAtomInitValue } from "./initAtom"
import { setAtoms } from "./setAtoms"
import { getState } from "./getState"
import { isAtom } from "../utils/isAtom"
import { isFamily } from "../utils/isFamily"
import { isSelector } from "../utils/isSelector"
import type { State } from "../types/State"
import type { StoreData } from "../types/StoreData"
import type { Atom } from "../types/Atom"
import type { TransactionFn } from "../types/TransactionFn"
import type { TransactionInterface } from "../types/TransactionInterface"

const findDependencies = (
    state: State,
    data: StoreData,
    result = new Set(),
) => {
    const consumers = data.stateConsumers.get(state)
    if (consumers?.size) {
        for (const consumer of consumers) {
            if (!result.has(consumer)) {
                result.add(consumer)
                findDependencies(consumer, data, result)
            }
        }
    }
    return result
}

type GetValdresValue = <V>(state: State<V>) => V
type SetValdresValue = <V>(state: State<V>, value: V) => void
type ResetValdresValue = <V>(atom: Atom<V>) => V

const recursivlyResetTxnSelectorCache = (
    state: State,
    txnSubscribers: Map<State, Set<State>>,
    txnSelectorCache: Map<State, any>,
) => {
    for (const dep of txnSubscribers.get(state) as Set<State>) {
        txnSelectorCache.delete(dep)
        if (txnSubscribers.get(dep)?.size) {
            recursivlyResetTxnSelectorCache(
                dep,
                txnSubscribers,
                txnSelectorCache,
            )
        }
    }
}

const captureScopedTransaction = (scopedData: StoreData) => {
    let txn: TransactionInterface
    transaction(
        scopedTxn => {
            txn = scopedTxn
        },
        scopedData,
        false,
    )
    // @ts-ignore
    return txn
}

type ScopedTransactionsRecord = Record<string, TransactionInterface>

export const transaction = (
    callback: TransactionFn,
    data: StoreData,
    autoCommit = true,
) => {
    let txnAtomMap = new Map()
    let txnSelectorCache = new Map()
    let txnSubscribers = new Map()
    let dirtySelectors = new Set()
    let scopedTransactions: ScopedTransactionsRecord

    const txnGet: GetValdresValue = state => {
        if (isAtom(state)) {
            return txnAtomMap.has(state)
                ? txnAtomMap.get(state)
                : getState(state, data)
        } else if (isSelector(state)) {
            if (txnSelectorCache.has(state)) {
                return txnSelectorCache.get(state)
            }
            const deps = new Set()
            // @ts-ignore, @ts-todo
            const res = state.get(s => {
                deps.add(s)
                return txnGet(s)
            }, data.id)
            for (const dep of deps) {
                if (!txnSubscribers.has(dep)) {
                    txnSubscribers.set(dep, new Set())
                }
                txnSubscribers.get(dep).add(state)
            }
            txnSelectorCache.set(state, res)
            return res
        } else if (isFamily(state)) {
            return txnAtomMap.has(state)
                ? txnAtomMap.get(state)
                : getState(state.__keysSelector, data)
        } else {
            throw new Error("Unsupported state")
        }
    }
    const txnSet: SetValdresValue = (atom, value) => {
        if (!isAtom(atom)) throw new Error("Not an atom")
        if (typeof value === "function") {
            const currentValue = txnGet(atom)
            value = value(currentValue)
        }
        for (const selector of findDependencies(atom, data)) {
            dirtySelectors.add(selector)
            txnSelectorCache.delete(selector)
        }
        if (txnSubscribers.get(atom)?.size) {
            recursivlyResetTxnSelectorCache(
                atom,
                txnSubscribers,
                txnSelectorCache,
            )
        }
        ///
        txnAtomMap.set(atom, value)
    }

    const txnReset: ResetValdresValue = atom => {
        const value = getAtomInitValue(atom, data)
        txnAtomMap.set(atom, value)
        return value
    }
    const commit = () => {
        setAtoms(txnAtomMap, data)
        dirtySelectors.clear()
        if (scopedTransactions) {
            for (const scopedTxn of Object.values(scopedTransactions)) {
                scopedTxn.commit()
            }
        }
    }
    const result = callback({
        set: txnSet,
        get: txnGet,
        reset: txnReset,
        commit,
        scope: (scopeId, callback) => {
            if (scopeId in data.scopes) {
                const scopedData = data.scopes[scopeId]
                if (scopedTransactions === undefined) {
                    scopedTransactions = {}
                }
                if (scopedTransactions[scopeId] === undefined) {
                    scopedTransactions[scopeId] =
                        captureScopedTransaction(scopedData)
                }
                return callback(scopedTransactions[scopeId])
            } else {
                throw new Error(
                    `Scope '${scopeId}' not found. Registered scopes: ${Object.keys(data.scopes).join(", ")}`,
                )
            }
        },
        data,
    })
    if (autoCommit) commit()
    return result
}
