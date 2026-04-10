import type { Atom } from "../types/Atom"
import type { AtomFamilyAtom } from "../types/AtomFamilyAtom"
import type { StoreData } from "../types/StoreData"
import { isPromiseLike } from "../utils/isPromiseLike"
import { isSelector } from "../utils/isSelector"
import { getState } from "./getState"
import { propagateUpdatedAtoms } from "./propagateUpdatedAtoms"
import { setAtom } from "./setAtom"
import { setValueInData } from "./setValueInData"
import { validateSchema } from "./validateSchema"

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
            value.then(
                resolvedValue => {
                    // Stale-promise guard: if a newer evaluation (e.g.
                    // from lazy maxAge revalidation or resetSelf+re-init)
                    // replaced our promise as the cached value, swallow
                    // this resolution. Mirrors setAtom.handlePromise.
                    if (data.values.get(atom) !== value) return
                    resolvedValue = validateSchema(atom.schema, resolvedValue, data)
                    // @ts-ignore @ts-todo
                    setValueInData(atom, resolvedValue, data)
                    propagateUpdatedAtoms([atom], data)
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
            return value
        }
        return validateSchema(atom.schema, value, data)
    } else if (isSelector(atom.defaultValue)) {
        return getState(atom.defaultValue, data, initializedAtomsSet)
    } else {
        return validateSchema(atom.schema, atom.defaultValue, data)
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
