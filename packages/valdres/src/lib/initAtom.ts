import type { Atom } from "../types/Atom"
import type { AtomFamilyAtom } from "../types/AtomFamilyAtom"
import type { StoreData } from "../types/StoreData"
import { isFamilyAtom } from "../utils/isFamilyAtom"
import { isPromiseLike } from "../utils/isPromiseLike"
import { isSelector } from "../utils/isSelector"
import { getState } from "./getState"
import { propagateUpdatedAtoms } from "./propagateUpdatedAtoms"
import { setAtom } from "./setAtom"

export const getAtomInitValue = <V>(atom: Atom<V>, data: StoreData) => {
    if (atom.defaultValue === undefined) {
        let promiseResolve: (value: any) => void
        const promise = new Promise(resolve => {
            promiseResolve = resolve
        })
        // @ts-ignore
        promise.__isEmptyAtomPromise__ = true
        // @ts-ignore
        promise.__resolveEmptyAtomPromise__ = promiseResolve
        return promise
    } else if (typeof atom.defaultValue === "function") {
        // @ts-ignore @ts-todo
        const value = atom.defaultValue()
        if (isPromiseLike(value)) {
            value.then(resolvedValue => {
                data.values.set(atom, resolvedValue)
                propagateUpdatedAtoms([atom], data)
            })
        }
        return value
    } else if (isSelector(atom.defaultValue)) {
        return getState(atom.defaultValue, data)
    } else {
        // data.values.set(atom, atom.defaultValue)
        return atom.defaultValue
    }
}

export const initAtom = <V, K>(
    atom: Atom<V> | AtomFamilyAtom<K, V>,
    data: StoreData,
) => {
    let value = getAtomInitValue(atom, data)
    data.values.set(atom, value)
    if (isFamilyAtom(atom)) {
        const currentKeySet = getState(atom.family.__keysAtom, data)
        if (!currentKeySet.has(atom.familyKey)) {
            const newSet = new Set(currentKeySet)
            newSet.add(atom.familyKey)
            setAtom(atom.family.__keysAtom, newSet, data, true)
        }
    }
    if (atom.onInit)
        atom.onInit((newVal: V) => {
            value = newVal
            setAtom(atom, newVal, data, true)
        }, data)
    return value
}
