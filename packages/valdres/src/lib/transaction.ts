import { isProd } from "../lib/isProd"
import type { Atom } from "../types/Atom"
import type { AtomFamilyAtom } from "../types/AtomFamilyAtom"
import type { GetValue } from "../types/GetValue"
import type { State } from "../types/State"
import type { StoreData } from "../types/StoreData"
import type { TransactionFn } from "../types/TransactionFn"
import type { TransactionInterface } from "../types/TransactionInterface"
import { deepFreeze } from "../utils/deepFreeze"
import { isAtom } from "../utils/isAtom"
import { isAtomFamily } from "../utils/isAtomFamily"
import { isFamilyAtom } from "../utils/isFamilyAtom"
import { isSelector } from "../utils/isSelector"
import { getState } from "./getState"
import { getAtomInitValue } from "./initAtom"
import { isFunction } from "./isFunction"
import { setAtoms } from "./setAtoms"

const findDependencies = (
    state: State,
    data: StoreData,
    result = new Set(),
) => {
    const dependents = data.stateDependents.get(state)
    if (dependents?.size) {
        for (const dependent of dependents) {
            if (!result.has(dependent)) {
                result.add(dependent)
                findDependencies(dependent, data, result)
            }
        }
    }
    return result
}

type GetValdresValue = <V>(state: State<V>) => V
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

type GetAtomValue = {
    <V>(atom: Atom<V>): V
}

const captureScopedTransaction = (
    scopedData: StoreData,
    parentGetInTxnOrData: GetAtomValue,
) => {
    let txn: TransactionInterface
    transaction(
        scopedTxn => {
            txn = scopedTxn
        },
        scopedData,
        false,
        parentGetInTxnOrData,
    )
    // @ts-ignore
    return txn
}

const deleteAtomFamilyAtoms = (
    set: Set<AtomFamilyAtom<any, any>>,
    data: StoreData,
) => {
    set.forEach(atom => {
        data.values.delete(atom)
    })
}

type ScopedTransactionsRecord = Record<string, TransactionInterface>

export const transaction = (
    callback: TransactionFn,
    data: StoreData,
    autoCommit = true,
    parentGetInTxnOrData?: GetAtomValue,
) => {
    const txnAtomMap = new Map()
    const txnAtomDeleteSet = new Set<AtomFamilyAtom<any, any>>()
    const txnSelectorCache = new Map()
    const txnSubscribers = new Map()
    const dirtySelectors = new Set()
    let scopedTransactions: ScopedTransactionsRecord

    const getInTxnOrData: GetAtomValue = state => {
        if (txnAtomMap.has(state)) {
            return txnAtomMap.get(state)
        }
        if (data.values.has(state)) {
            return data.values.get(state)
        }
        if (parentGetInTxnOrData) {
            return parentGetInTxnOrData(state)
        }
    }

    const initializedAtomsSet = new Set<Atom>()
    // @ts-ignore @ts-todo
    const txnGet: GetValue = state => {
        if (isAtom(state)) {
            const value = getInTxnOrData(state)
            if (value) return value
            return getState(state, data, initializedAtomsSet)
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
        } else if (isAtomFamily(state)) {
            const value = getInTxnOrData(state)
            if (value) return value
            return getState(state, data, initializedAtomsSet)
        } else {
            throw new Error("Unsupported state")
        }
    }
    // @ts-ignore @ts-todo
    const txnSet = <V>(atom: Atom<V>, value: V | ((currentValue: V) => V)) => {
        if (!isAtom(atom)) throw new Error("Not an atom")
        if (isFunction(value)) {
            const currentValue = txnGet(atom)
            // @ts-ignore @ts-todo
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
        if (isProd()) {
            txnAtomMap.set(atom, value)
        } else {
            txnAtomMap.set(atom, deepFreeze(value))
        }

        if (isFamilyAtom(atom)) {
            const currentFamilyList = txnGet(atom.family)
            if (!currentFamilyList.includes(atom)) {
                const newArr = [...currentFamilyList, atom]
                txnAtomMap.set(atom.family, newArr)
            }
        }
        return value
    }

    const txnReset: ResetValdresValue = atom => {
        const value = getAtomInitValue(atom, data, initializedAtomsSet)
        txnAtomMap.set(atom, value)
        return value
    }

    const txnDel = (atom: AtomFamilyAtom<any, any>) => {
        const array = txnGet(atom.family)
        const index = array.indexOf(atom)
        const newArr: AtomFamilyAtom<any, any>[] = [
            ...array.slice(0, index),
            ...array.slice(index + 1),
        ]
        txnAtomMap.set(atom.family, newArr)
        if (data.values.has(atom)) {
            txnAtomDeleteSet.add(atom)
        }
        if (txnAtomMap.has(atom)) {
            txnAtomMap.delete(atom)
        }
    }

    const commit = () => {
        setAtoms(txnAtomMap, data, initializedAtomsSet)
        if (txnAtomDeleteSet.size) {
            deleteAtomFamilyAtoms(txnAtomDeleteSet, data)
        }
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
        del: txnDel,
        reset: txnReset,
        commit,
        scope: (scopeId, callback) => {
            if (scopeId in data.scopes) {
                const scopedData = data.scopes[scopeId]
                if (scopedTransactions === undefined) {
                    scopedTransactions = {}
                }
                if (scopedTransactions[scopeId] === undefined) {
                    scopedTransactions[scopeId] = captureScopedTransaction(
                        scopedData,
                        getInTxnOrData,
                    )
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
