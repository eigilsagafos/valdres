import type { Atom } from "../types/Atom"
import type { AtomFamilyAtom } from "../types/AtomFamilyAtom"
import type { StoreData } from "../types/StoreData"
import { isPromiseLike } from "../utils/isPromiseLike"
import { isSelector } from "../utils/isSelector"
import { getState } from "./getState"
import { propagateAtomUpdate } from "./propagateUpdatedAtoms"
import { setAtom } from "./setAtom"
import { setValueInData } from "./setValueInData"
import { validateResolvedValue } from "./validateResolvedValue"
import { validateSchema } from "./validateSchema"

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
                    if (!validateResolvedValue(atom, resolvedValue, data)) {
                        // Invalid: failure already reported; drop the stored
                        // promise so a re-subscribe re-inits, rather than
                        // committing the invalid value or leaving the atom
                        // stuck on an unvalidated promise.
                        if (data.values.get(atom) === value) {
                            data.values.delete(atom)
                        }
                        return
                    }
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
            return value
        }
        return validateSchema(atom, value, data)
    } else if (isSelector(atom.defaultValue)) {
        const value = getState(atom.defaultValue, data, initializedAtomsSet)
        if (isPromiseLike(value)) {
            // The atom's value IS the source selector's promise (consumers await
            // it). The source selector validates against its OWN schema, if any;
            // here we additionally validate the resolved value against THIS
            // atom's schema and report on failure — so an async selector default
            // is covered like every other boundary. Unlike the function-default
            // branch above we neither re-land the value (it's the shared
            // promise, not a freshly-set atom value) nor drop the atom's cache
            // on failure (re-init would just re-read the selector's cached
            // result, so dropping buys nothing — awaiters of the shared promise
            // see the raw resolved value either way; the report is the signal).
            // Gated on schema presence so schema-less atoms pay no handler
            // allocation (validateResolvedValue re-checks the full gate).
            if (atom.schema) {
                value.then(
                    resolved => validateResolvedValue(atom, resolved, data),
                    () => {}, // genuine rejection is handled by the selector's path
                )
            }
            return value
        }
        return validateSchema(atom, value, data)
    } else {
        // Narrowed: not undefined, not a function, not a selector — so the
        // default is a plain value of type V.
        return validateSchema(atom, atom.defaultValue as V, data)
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
