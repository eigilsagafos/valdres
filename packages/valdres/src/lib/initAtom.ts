import type { Atom } from "../types/Atom"
import type { AtomFamilyAtom } from "../types/AtomFamilyAtom"
import type { StoreData } from "../types/StoreData"
import { isFamilyAtom } from "../utils/isFamilyAtom"
import { isPromiseLike } from "../utils/isPromiseLike"
import { isSelector } from "../utils/isSelector"
import { getState } from "./getState"
import { propagateUpdatedAtoms } from "./propagateUpdatedAtoms"
import { setAtom } from "./setAtom"
import { setValueInData } from "./setValueInData"

export const getAtomInitValue = <V = any>(atom: Atom<V>, data: StoreData) => {
    if (atom.defaultValue === undefined) {
        let promiseResolve: (value: any) => void
        const promise = new Promise(resolve => {
            promiseResolve = resolve
        })
        // @ts-ignore @ts-todo
        promise.__isEmptyAtomPromise__ = true
        // @ts-ignore @ts-todo
        promise.__resolveEmptyAtomPromise__ = promiseResolve
        return promise
    } else if (typeof atom.defaultValue === "function") {
        // @ts-ignore @ts-todo
        const value = atom.defaultValue()
        if (isPromiseLike(value)) {
            value.then(resolvedValue => {
                // @ts-ignore @ts-todo
                setValueInData(atom, resolvedValue, data)
                propagateUpdatedAtoms([atom], data)
            })
        }
        return value
    } else if (isSelector(atom.defaultValue)) {
        return getState(atom.defaultValue, data)
    } else {
        return atom.defaultValue
    }
}

export const initAtom = <
    Value extends any,
    Args extends [any, ...any[]] = [any, ...any[]],
>(
    atom: Atom<Value> | AtomFamilyAtom<Value, Args>,
    data: StoreData,
) => {
    const tmpVal = getAtomInitValue(atom, data)
    let value = setValueInData(atom, tmpVal, data)
    if (isFamilyAtom(atom)) {
        const currentKeySet = getState(atom.family.__keysAtom, data)
        if (!currentKeySet.has(atom.familyKey)) {
            const newSet = new Set(currentKeySet)
            newSet.add(atom.familyKey)
            setAtom(atom.family.__keysAtom, newSet, data)
        }
    }
    if (atom.onInit)
        atom.onInit((newVal: Value) => {
            value = newVal
            setAtom(atom, newVal, data, true)
        }, data)
    return value
}
