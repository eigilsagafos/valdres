import { getAtomInitValue } from "./initAtom"
import { setAtoms } from "./setAtoms"
import { getState } from "./getState"
import { isAtom } from "../utils/isAtom"
import type { State } from "../types/State"
import type { StoreData } from "../types/StoreData"

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
type ResetValdresValue = <V>(state: State<V>) => V
type TransactionInterface = (
    set: SetValdresValue,
    get: GetValdresValue,
    reset: ResetValdresValue,
    commit: () => void,
) => void

export const transaction = (
    callback: TransactionInterface,
    data: StoreData,
) => {
    let txnAtomMap = new Map()
    let txnSelectorCache = new Map()
    let dirtySelectors = new Set()

    const txnGet: GetValdresValue = state => {
        if (isAtom(state)) {
            return txnAtomMap.has(state)
                ? txnAtomMap.get(state)
                : getState(state, data)
        } else {
            if (txnSelectorCache.has(state)) {
                return txnSelectorCache.get(state)
            } else if (dirtySelectors.has(state)) {
                const res = state.get(txnGet)
                txnSelectorCache.set(state, res)
                return res
            } else {
                return getState(state, data)
            }
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
    }
    const result = callback(txnSet, txnGet, txnReset, commit)
    commit()
    return result
}
