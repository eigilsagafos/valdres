import type { Atom } from "../types/Atom"
import type { AtomFamilyAtom } from "../types/AtomFamilyAtom"
import type { StoreData } from "../types/StoreData"
import { isPromiseLike } from "../utils/isPromiseLike"
import { isSelector } from "../utils/isSelector"
import { getState } from "./getState"
import { propagateUpdatedAtoms } from "./propagateUpdatedAtoms"
import { setAtom } from "./setAtom"
import { setValueInData } from "./setValueInData"

export const getAtomInitValue = <V = any>(
    atom: Atom<V>,
    data: StoreData,
    initializedAtomsSet: Set<Atom>,
) => {
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
        return getState(atom.defaultValue, data, initializedAtomsSet)
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
    initializedAtomsSet: Set<Atom>,
) => {
    const tmpVal = getAtomInitValue(atom, data, initializedAtomsSet)
    let value = setValueInData(atom, tmpVal, data)
    if (atom.onInit)
        atom.onInit((newVal: Value) => {
            value = newVal
            setAtom(atom, newVal, data, true)
        }, data)
}
