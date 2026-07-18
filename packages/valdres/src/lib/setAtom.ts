import type { Atom } from "../types/Atom"
import type { SetAtomValue } from "../types/SetAtomValue"
import type { StoreData } from "../types/StoreData"
import { isGlobalAtom } from "../utils/isGlobalAtom"
import { isPromiseLike } from "../utils/isPromiseLike"
import {
    createCommitErrors,
    recordCommitError,
    throwCommitError,
} from "./commitErrors"
import { getState } from "./getState"
import {
    applyGlobalSets,
    beginGlobalCommit,
    endGlobalCommit,
} from "./globalAtomFanOut"
import { createChangeSink, flushChangeSink } from "./notifyChangeListeners"
import {
    notifyDeferred,
    propagateAtomUpdate,
    type NotifyTarget,
} from "./propagateUpdatedAtoms"
import { isFunction } from "./isFunction"
import { resolvePendingDefault } from "./resolvePendingDefault"
import { setValueInData } from "./setValueInData"
import { validateResolvedValue } from "./validateResolvedValue"
import { validateSchema } from "./validateSchema"

/**
 * Slow path for a settled write carrying an onSet hook (global atoms always
 * carry a no-op marker hook). Global peer writes are applied first, then the
 * hook runs, then every store propagates and notifies. Errors never interrupt a
 * later phase; the first is rethrown last.
 */
const finishAtomSet = <Value>(
    atom: Atom<Value>,
    value: Value,
    data: StoreData,
    updatedAtoms: Atom<any>[],
    source: "set" | "async-set",
) => {
    if (!isGlobalAtom(atom)) {
        let hasHookError = false
        let hookError: unknown
        try {
            atom.onSet!(value, data)
        } catch (error) {
            hasHookError = true
            hookError = error
        }
        try {
            propagateAtomUpdate(updatedAtoms, data, false, undefined, source)
        } catch (error) {
            if (hasHookError) throw hookError
            throw error
        }
        if (hasHookError) throw hookError
        return
    }

    const errors = createCommitErrors()
    const globalUpdates = applyGlobalSets([[atom, value]], errors)

    try {
        atom.onSet!(value, data)
    } catch (error) {
        recordCommitError(errors, error)
    }

    if (globalUpdates.size === 0) {
        try {
            propagateAtomUpdate(updatedAtoms, data, false, undefined, source)
        } catch (error) {
            recordCommitError(errors, error)
        }
    } else {
        const notify: NotifyTarget = new Map()
        const changeSink = createChangeSink(undefined, source)
        const commitRoots = beginGlobalCommit(data, globalUpdates)
        // Preserve global onChange ordering: peers report before the origin.
        for (const [peer, peerAtoms] of globalUpdates) {
            try {
                propagateAtomUpdate(peerAtoms, peer, false, notify, changeSink)
            } catch (error) {
                recordCommitError(errors, error)
            }
        }
        try {
            propagateAtomUpdate(updatedAtoms, data, false, notify, changeSink)
        } catch (error) {
            recordCommitError(errors, error)
        }
        try {
            notifyDeferred(notify)
        } catch (error) {
            recordCommitError(errors, error)
        }
        try {
            flushChangeSink(changeSink)
        } catch (error) {
            recordCommitError(errors, error)
        }
        endGlobalCommit(commitRoots, errors)
    }

    throwCommitError(errors)
}

const handlePromise = <Value>(
    atom: Atom<Value>,
    promise: Promise<Value>,
    currentValue: Value,
    data: StoreData,
    skipOnSet: boolean,
) => {
    setValueInData(atom, promise as Value, data)
    promise
        .then(resolvedValue => {
            // Stale promise guard: if another set() overwrote us, bail
            if (data.values.get(atom) !== promise) return
            // Async validation can't throw to the original caller (the promise
            // was already returned), so it's reported and we revert — the
            // invalid value never lands. Sync sets throw from store.set directly.
            if (!validateResolvedValue(atom, resolvedValue, data)) {
                if (data.values.get(atom) === promise) {
                    setValueInData(atom, currentValue, data)
                    propagateAtomUpdate([atom], data, false, undefined, "async-set")
                }
                return
            }
            setValueInData(atom, resolvedValue, data)
            resolvePendingDefault(atom, data, resolvedValue)
            if (atom.onSet && !skipOnSet) {
                finishAtomSet(atom, resolvedValue, data, [atom], "async-set")
            } else {
                // Ordinary atoms retain the original inline, allocation-free
                // propagation path. Only hook/global writes pay for phased
                // error handling.
                propagateAtomUpdate(
                    [atom],
                    data,
                    false,
                    undefined,
                    "async-set",
                )
            }
        })
        // Chained .catch so errors thrown inside the fulfilled handler
        // (e.g. from atom.onSet) don't surface as unhandled rejections.
        .catch(() => {
            // Only revert if the promise is still the current in-flight value;
            // if a fulfilled handler partially updated state, the guard below
            // lets us avoid clobbering it.
            if (data.values.get(atom) !== promise) return
            setValueInData(atom, currentValue, data)
            propagateAtomUpdate([atom], data, false, undefined, "async-set")
        })
}

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
        // Same promise reference — no-op (matches equality check below)
        if (currentValue === promise) return promise as Value
        handlePromise(atom, promise, currentValue, data, skipOnSet)
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
    resolvePendingDefault(atom, data, syncValue)
    let updatedAtoms: Atom<any>[]
    if (initializedAtomsSet && initializedAtomsSet.size > 0) {
        initializedAtomsSet.add(atom)
        updatedAtoms = [...initializedAtomsSet]
    } else {
        updatedAtoms = [atom]
    }
    if (atom.onSet && !skipOnSet) {
        finishAtomSet(atom, syncValue, data, updatedAtoms, "set")
    } else {
        propagateAtomUpdate(updatedAtoms, data, false, undefined, "set")
    }
    return syncValue
}
