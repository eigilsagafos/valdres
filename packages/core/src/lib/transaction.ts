import { getAtomInitValue } from "./initAtom"
import { setAtoms } from "./setAtoms"
import { getState } from "./getState"
import { isAtom } from "../utils/isAtom"
import type { Atom } from "../types/Atom"
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
    let txnMap = new Map()
    let dirtySelectors = new Set()

    const txnGet: GetValdresValue = state => {
        // console.log(dirtySelectors)
        if (dirtySelectors.has(state)) {
            throw new Error("The selector you are trying to access is dirty")
        }
        const value = txnMap.get(state) ?? getState(state, data)
        return value
    }
    const txnSet: SetValdresValue = (atom, value) => {
        if (!isAtom(atom)) throw new Error("Not an atom")
        if (typeof value === "function") {
            const currentValue = txnGet(atom)
            value = value(currentValue)
        }
        if (!txnMap.has(atom)) {
            for (const selector of findDependencies(atom, data)) {
                dirtySelectors.add(selector)
            }
        }
        txnMap.set(atom, value)
        commit()
    }

    const txnReset: ResetValdresValue = atom => {
        const value = getAtomInitValue(atom, data)
        txnMap.set(atom, value)
        return value
    }
    const commit = () => {
        setAtoms(txnMap, data)
        dirtySelectors.clear()
    }
    const result = callback(txnSet, txnGet, txnReset, commit)
    commit()
    return result
}
