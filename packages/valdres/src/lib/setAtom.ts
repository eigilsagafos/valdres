import type { Atom } from "../types/Atom"
import type { DirectWriteIntent } from "../types/CommitIntent"
import type { SetAtomValue } from "../types/SetAtomValue"
import type { StoreData } from "../types/StoreData"
import { isGlobalAtom } from "../utils/isGlobalAtom"
import { isPromiseLike } from "../utils/isPromiseLike"
import { runHookedDirectWrite } from "./commitEngine"
import { DIRECT_WRITE, SETTLE_DEFAULT } from "./commitIntents"
import { coordinateAsyncWrite } from "./coordinateAsyncWrite"
import { finishAtomSet } from "./finishAtomSet"
import { getState } from "./getState"
import { settleCommit } from "./propagateUpdatedAtoms"
import { isFunction } from "./isFunction"
import { resolvePendingDefault } from "./resolvePendingDefault"
import { setValueInData } from "./setValueInData"
import { validateSchema } from "./validateSchema"

/**
 * Direct-write coordinator of the commit engine: one atom, one store. Phases
 * 1–2 run inline (normalize/validate/equality-bail → apply), then dispatch:
 * the ordinary write (no hook — which also means non-global, since global
 * atoms always carry at least the marker hook) settles immediately with a
 * shared frozen flags const — no plan object, no allocation; a hooked
 * non-global write runs phases 3–9 through the engine; ordinary global fan-out
 * stays on finishAtomSet, while coordinateAsyncWrite routes final async
 * transitions through the same engine.
 */
export const setAtom = <Value = any>(
    atom: Atom<Value>,
    newValue: SetAtomValue<Value>,
    data: StoreData,
    intent: DirectWriteIntent = DIRECT_WRITE,
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
                coordinateAsyncWrite(
                    atom,
                    promise,
                    currentValue,
                    data,
                    intent.effects === "skip",
                )
            }
            return promise as Value
        }
        coordinateAsyncWrite(
            atom,
            promise,
            currentValue,
            data,
            intent.effects === "skip",
        )
        if (initializedAtomsSet && initializedAtomsSet.size > 0) {
            initializedAtomsSet.add(atom)
            settleCommit(
                [...initializedAtomsSet],
                data,
                undefined,
                "set",
                SETTLE_DEFAULT,
            )
        } else {
            settleCommit([atom], data, undefined, "set", SETTLE_DEFAULT)
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
    if (atom.onSet && intent.effects === "run") {
        // Global atoms always carry (at least) the marker hook, so this branch
        // is the only route to global fan-out; a seed (effects: "skip") falls
        // through below — no hooks, no fan-out, exactly the historical
        // skipOnSet semantics.
        if (isGlobalAtom(atom)) {
            finishAtomSet(atom, syncValue, data, updatedAtoms, "set")
        } else {
            runHookedDirectWrite(
                atom,
                syncValue,
                data,
                updatedAtoms,
                "set",
                settleCommit,
            )
        }
    } else {
        settleCommit(updatedAtoms, data, undefined, "set", SETTLE_DEFAULT)
    }
    return syncValue
}
