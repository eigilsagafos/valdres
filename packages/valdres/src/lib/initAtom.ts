import type { Atom } from "../types/Atom"
import type { AtomFamilyAtom } from "../types/AtomFamilyAtom"
import type { StoreData } from "../types/StoreData"
import { isPromiseLike } from "../utils/isPromiseLike"
import { isSelector } from "../utils/isSelector"
import { getState } from "./getState"
import { propagateAtomUpdate } from "./propagateUpdatedAtoms"
import { setAtom } from "./setAtom"
import { setValueInData } from "./setValueInData"

export const getAtomInitValue = <V = any>(
    atom: Atom<V>,
    data: StoreData,
    initializedAtomsSet: Set<Atom>,
) => {
    if (atom.defaultValue === undefined) {
        let resolve!: (value: any) => void
        const promise = new Promise(r => {
            resolve = r
        })
        data.pendingDefaults.set(atom, { promise, resolve })
        return promise
    } else if (typeof atom.defaultValue === "function") {
        // @ts-ignore @ts-todo
        const value = atom.defaultValue()
        if (isPromiseLike(value)) {
            value.then(
                resolvedValue => {
                    // Stale-promise guard: if a newer evaluation (e.g.
                    // from lazy maxAge revalidation or resetSelf+re-init)
                    // replaced our promise as the cached value, swallow
                    // this resolution. Mirrors setAtom.handlePromise.
                    if (data.values.get(atom) !== value) return
                    // @ts-ignore @ts-todo
                    setValueInData(atom, resolvedValue, data)
                    propagateAtomUpdate([atom], data, false, undefined, "async-set")
                },
                () => {
                    // On rejection, remove the rejected promise from the
                    // store so that re-subscribing triggers a fresh init
                    // rather than being stuck with a rejected promise.
                    if (data.values.get(atom) === value) {
                        data.values.delete(atom)
                    }
                },
            )
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
