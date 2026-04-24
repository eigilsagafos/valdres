import type { Atom } from "../types/Atom"
import type { SetAtomValue } from "../types/SetAtomValue"
import type { StoreData } from "../types/StoreData"
import { isPromiseLike } from "../utils/isPromiseLike"
import { getState } from "./getState"
import { propagateUpdatedAtoms } from "./propagateUpdatedAtoms"
import { isFunction } from "./isFunction"
import { setValueInData } from "./setValueInData"

export const setAtom = <Value = any>(
    atom: Atom<Value>,
    newValue: SetAtomValue<Value>,
    data: StoreData,
    skipOnSet = false,
) => {
    let initializedAtomsSet: Set<Atom> | undefined
    let currentValue: Value
    if (data.values.has(atom)) {
        currentValue = data.values.get(atom)
    } else {
        initializedAtomsSet = new Set<Atom>()
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
        // Same promise reference — no-op (matches equality check below)
        if (currentValue === promise) return promise as Value
        // @ts-ignore
        // Preserve the empty-atom resolver so racing async sets can
        // forward it even when the first set becomes stale.
        const emptyAtomPromise = currentValue?.__isEmptyAtomPromise__
            ? currentValue
            // @ts-ignore
            : currentValue?.__emptyAtomPromiseOrigin__ ?? null
        if (emptyAtomPromise) {
            // @ts-ignore
            promise.__emptyAtomPromiseOrigin__ = emptyAtomPromise
        }
        setValueInData(atom, promise as Value, data)
        promise.then(
            resolvedValue => {
                // Stale promise guard: if another set() overwrote us, bail
                if (data.values.get(atom) !== promise) return
                setValueInData(atom, resolvedValue, data)
                if (atom.onSet && !skipOnSet) atom.onSet(resolvedValue, data)
                if (emptyAtomPromise) {
                    // @ts-ignore
                    emptyAtomPromise.__resolveEmptyAtomPromise__(resolvedValue)
                }
                propagateUpdatedAtoms([atom], data)
            },
            () => {
                // On rejection, revert to previous value if promise is still current
                if (data.values.get(atom) !== promise) return
                setValueInData(atom, currentValue, data)
                propagateUpdatedAtoms([atom], data)
            },
        )
        if (initializedAtomsSet && initializedAtomsSet.size > 0) {
            initializedAtomsSet.add(atom)
            propagateUpdatedAtoms([...initializedAtomsSet], data)
        } else {
            propagateUpdatedAtoms([atom], data)
        }
        return promise as Value
    }
    // Past the isPromiseLike branch newValue is guaranteed to be a plain
    // Value (TypeScript can't narrow out PromiseLike fully, so we restate it).
    let syncValue = newValue as Value
    const areEqual = isPromiseLike(currentValue)
        ? currentValue === syncValue
        : atom.equal(currentValue, syncValue)
    if (areEqual) return syncValue
    syncValue = setValueInData(atom, syncValue, data)
    if (atom.onSet && !skipOnSet) atom.onSet(syncValue, data)
    // @ts-ignore
    if (currentValue?.__isEmptyAtomPromise__) {
        // @ts-ignore
        currentValue.__resolveEmptyAtomPromise__(syncValue)
    }
    if (initializedAtomsSet && initializedAtomsSet.size > 0) {
        initializedAtomsSet.add(atom)
        propagateUpdatedAtoms([...initializedAtomsSet], data)
    } else {
        propagateUpdatedAtoms([atom], data)
    }
    return syncValue
}
