import type { Atom } from "../types/Atom"
import type { StoreData } from "../types/StoreData"
import { isPromiseLike } from "../utils/isPromiseLike"
import { getState } from "./getState"
import { propagateUpdatedAtoms } from "./propagateUpdatedAtoms"
import { isFunction } from "./isFunction"

const deepFreeze = (obj: any, seen = new WeakSet()) => {
    if (seen.has(obj)) return obj
    if (obj && typeof obj === "object") seen.add(obj)

    if (Array.isArray(obj)) {
        for (const item of obj) {
            if (item && typeof item === "object") {
                deepFreeze(item, seen)
            }
        }
    } else {
        const propNames = Object.getOwnPropertyNames(obj)
        for (const name of propNames) {
            const value = obj[name]
            if (value && typeof value === "object") {
                deepFreeze(value, seen)
            }
        }
    }
    return Object.freeze(obj)
}

const isDev = process.env.NODE_ENV === "development"

export const setAtom = <Value = any>(
    atom: Atom<Value>,
    newValue: Value | ((currentValue: Value) => Value),
    data: StoreData,
    skipOnSet = false,
) => {
    const currentValue = getState(atom, data)
    if (isFunction(newValue)) {
        newValue = newValue(currentValue)
        if (isPromiseLike(newValue) || isPromiseLike(currentValue))
            throw new Error("Todo, how should we handle this?")
    }
    if (atom.equal(currentValue, newValue)) return newValue
    const frozenNewValue = isDev ? deepFreeze(newValue) : newValue
    data.values.set(atom, frozenNewValue)
    if (atom.onSet && !skipOnSet) atom.onSet(frozenNewValue, data)
    // @ts-ignore
    if (currentValue?.__isEmptyAtomPromise__) {
        // @ts-ignore
        currentValue.__resolveEmptyAtomPromise__(frozenNewValue)
    }

    propagateUpdatedAtoms([atom], data)
    return frozenNewValue
}
