import type { Atom } from "../types/Atom"
import type { StoreData } from "../types/StoreData"
import { isPromiseLike } from "../utils/isPromiseLike"
import { getState } from "./getState"
import { propagateUpdatedAtoms } from "./propagateUpdatedAtoms"
import { isFunction } from "./isFunction"
import { setValueInData } from "./setValueInData"

export const setAtom = <Value = any>(
    atom: Atom<Value>,
    newValue: Value | ((currentValue: Value) => Value),
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
        if (isPromiseLike(newValue)) {
            const promise = newValue as Promise<Value>
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
            promise.then(resolvedValue => {
                // Stale promise guard: if another set() overwrote us, bail
                if (data.values.get(atom) !== promise) return
                setValueInData(atom, resolvedValue, data)
                if (atom.onSet && !skipOnSet) atom.onSet(resolvedValue, data)
                if (emptyAtomPromise) {
                    // @ts-ignore
                    emptyAtomPromise.__resolveEmptyAtomPromise__(resolvedValue)
                }
                propagateUpdatedAtoms([atom], data)
            }).catch(() => {
                // On rejection, revert to previous value if promise is still current
                if (data.values.get(atom) !== promise) return
                setValueInData(atom, currentValue, data)
                propagateUpdatedAtoms([atom], data)
            })
            if (initializedAtomsSet && initializedAtomsSet.size > 0) {
                initializedAtomsSet.add(atom)
                propagateUpdatedAtoms([...initializedAtomsSet], data)
            } else {
                propagateUpdatedAtoms([atom], data)
            }
            return promise as Value
        }
    }
    if (isPromiseLike(newValue)) {
        throw new Error(
            "setAtom received a bare Promise. Pass a thunk instead: " +
                "set(atom, () => promise). A bare promise would be stored " +
                "without awaiting resolution, silently leaving subscribers " +
                "on the unresolved reference.",
        )
    }
    const areEqual = isPromiseLike(currentValue)
        ? currentValue === newValue
        : atom.equal(currentValue, newValue)
    if (areEqual) return newValue
    newValue = setValueInData(atom, newValue, data)
    if (atom.onSet && !skipOnSet) atom.onSet(newValue, data)
    // @ts-ignore
    if (currentValue?.__isEmptyAtomPromise__) {
        // @ts-ignore
        currentValue.__resolveEmptyAtomPromise__(newValue)
    }
    if (initializedAtomsSet && initializedAtomsSet.size > 0) {
        initializedAtomsSet.add(atom)
        propagateUpdatedAtoms([...initializedAtomsSet], data)
    } else {
        propagateUpdatedAtoms([atom], data)
    }
    return newValue
}
