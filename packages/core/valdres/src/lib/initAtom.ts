import { isPromiseLike } from "../utils/isPromiseLike"
import { propagateUpdatedAtoms } from "./propagateUpdatedAtoms"
import type { Atom } from "../types/Atom"
import type { StoreData } from "../types/StoreData"
import { setAtom } from "./setAtom"

export const getAtomInitValue = <V>(atom: Atom<V>, data: StoreData) => {
    if (atom.defaultValue === undefined) {
        let promiseResolve: (value: any) => void
        const promise = new Promise(resolve => {
            promiseResolve = resolve
        })
        promise.__isEmptyAtomPromise__ = true
        promise.__resolveEmptyAtomPromise__ = promiseResolve
        return promise
    } else if (typeof atom.defaultValue === "function") {
        const value = atom.defaultValue()
        if (isPromiseLike(value)) {
            value.then(resolvedValue => {
                data.values.set(atom, resolvedValue)
                propagateUpdatedAtoms([atom], data)
            })
        }
        return value
    } else {
        // data.values.set(atom, atom.defaultValue)
        return atom.defaultValue
    }
}

export const initAtom = <V>(atom: Atom<V>, data: StoreData) => {
    const value = getAtomInitValue(atom, data)
    data.values.set(atom, value)
    if (atom.onInit)
        atom.onInit((newVal: V) => {
            setAtom(atom, newVal, data)
        })
    return value
}
