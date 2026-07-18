import type { Atom } from "../types/Atom"
import type { SetAtomValue } from "../types/SetAtomValue"
import type { StoreData } from "../types/StoreData"
import { isPromiseLike } from "../utils/isPromiseLike"
import { coordinateAsyncWrite } from "./coordinateAsyncWrite"
import { getState } from "./getState"
import { propagateAtomUpdate } from "./propagateUpdatedAtoms"
import { isFunction } from "./isFunction"
import { resolvePendingDefault } from "./resolvePendingDefault"
import { setValueInData } from "./setValueInData"
import { validateSchema } from "./validateSchema"

export const setAtom = <Value = any>(
    atom: Atom<Value>,
    newValue: SetAtomValue<Value>,
    data: StoreData,
    skipOnSet = false,
) => {
    let initializedAtomsSet: Set<Atom<any>> | undefined
    let currentValue: Value
    if (data.values.has(atom)) {
        currentValue = data.values.get(atom)
    } else {
        initializedAtomsSet = new Set<Atom<any>>()
        currentValue = getState(atom, data, initializedAtomsSet)
    }
    if (isFunction(newValue)) {
        newValue = newValue(currentValue)
    }
    if (isPromiseLike(newValue)) {
        // Normalize thenables to real Promises so internal code (including
        // downstream .catch/.finally handlers) always works on a Promise.
        // Promise.resolve(realPromise) returns the same reference, so this
        // is a no-op allocation for the common case.
        const promise = Promise.resolve(newValue) as Promise<Value>
        // Same own promise reference is a no-op. In a scope that still reads
        // through to its parent, however, an explicit equal set must pin a local
        // shadow just like the settled-value branch below.
        if (currentValue === promise) {
            if (data.parent && !data.values.has(atom)) {
                coordinateAsyncWrite(atom, promise, currentValue, data, skipOnSet)
            }
            return promise as Value
        }
        coordinateAsyncWrite(atom, promise, currentValue, data, skipOnSet)
        if (initializedAtomsSet && initializedAtomsSet.size > 0) {
            initializedAtomsSet.add(atom)
            propagateAtomUpdate([...initializedAtomsSet], data, false, undefined, "set")
        } else {
            propagateAtomUpdate([atom], data, false, undefined, "set")
        }
        return promise as Value
    }
    // Past the isPromiseLike branch newValue is guaranteed to be a plain
    // Value (TypeScript can't narrow out PromiseLike fully, so we restate it).
    let syncValue = validateSchema(atom, newValue as Value, data)
    const areEqual = isPromiseLike(currentValue)
        ? currentValue === syncValue
        : atom.equal(currentValue, syncValue)
    if (areEqual) {
        // On a scope, an atom that hasn't been shadowed yet is read through to a
        // parent, so `currentValue` is the INHERITED value. Setting it to a value
        // equal to the inherited one must STILL establish the shadow — otherwise
        // the scope keeps tracking the parent and a later parent write leaks in,
        // silently dropping this explicit override (and a delegating subscription
        // never re-roots). setValueInData pins the value, registers the shadow in
        // scopeValueIndex, and re-roots any delegating subscriptions. The visible
        // value is unchanged, so there is nothing to propagate or notify. This
        // mirrors writeAtoms' equal branch, which already does this for the txn
        // commit path. On a root (no parent) or an already-shadowed scope atom
        // this is a true no-op, so the write hot path is untouched.
        if (data.parent && !data.values.has(atom)) {
            return setValueInData(atom, syncValue, data)
        }
        return syncValue
    }
    syncValue = setValueInData(atom, syncValue, data)
    if (atom.onSet && !skipOnSet) atom.onSet(syncValue, data)
    resolvePendingDefault(atom, data, syncValue)
    if (initializedAtomsSet && initializedAtomsSet.size > 0) {
        initializedAtomsSet.add(atom)
        propagateAtomUpdate([...initializedAtomsSet], data, false, undefined, "set")
    } else {
        propagateAtomUpdate([atom], data, false, undefined, "set")
    }
    return syncValue
}
