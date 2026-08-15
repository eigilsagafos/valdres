import type { Atom } from "../types/Atom"
import type { AtomFamilyAtom } from "../types/AtomFamilyAtom"
import type { InternalAtom } from "../types/InternalAtom"
import type { StoreData } from "../types/StoreData"
import { isPromiseLike } from "../utils/isPromiseLike"
import { isSelector } from "../utils/isSelector"
import { createScalarCommit, runCommitPlan } from "./commitEngine"
import { createCommitErrors } from "./commitErrors"
import { SEED_WRITE, SETTLE_DEFAULT } from "./commitIntents"
import { NO_ON_SETS, updateSettlement } from "./commitPlans"
import { getState } from "./getState"
import { hasAtomCommitObservers } from "./hasAtomCommitObservers"
import { settleCommit } from "./propagateUpdatedAtoms"
import { setAtom } from "./setAtom"
import { setValueInData } from "./setValueInData"
import { pendingDefaultPromise } from "./resolvePendingDefault"
import { noteStateValueChanged } from "./stateRevisions"
import { isStoreDisposed } from "./storeLifecycle"
import { trackNamedState, untrackNamedAtom } from "./namedStateIndex"
import { validateResolvedValue } from "./validateResolvedValue"
import { validateSchema } from "./validateSchema"

const admitFunctionDefaultTransition = (
    atom: Atom<any>,
    _resolvedValue: any,
    promise: PromiseLike<any>,
    data: StoreData,
    _unused1: undefined,
    _unused2: undefined,
): boolean => !isStoreDisposed(data) && data.values.get(atom) === promise

const applyFunctionDefaultResolution = (
    atom: Atom<any>,
    resolvedValue: any,
    _promise: PromiseLike<any>,
    data: StoreData,
    _unused1: undefined,
    _unused2: undefined,
) => {
    setValueInData(atom, resolvedValue, data)
}

const applyFunctionDefaultCleanup = (
    atom: Atom<any>,
    _resolvedValue: any,
    _promise: PromiseLike<any>,
    data: StoreData,
    _unused1: undefined,
    _unused2: undefined,
) => {
    data.values.delete(atom)
    untrackNamedAtom(atom, data)
    noteStateValueChanged(atom, data)
}

const commitFunctionDefaultResolution = createScalarCommit(
    applyFunctionDefaultResolution,
)
const commitFunctionDefaultCleanup = createScalarCommit(
    applyFunctionDefaultCleanup,
)

export const getAtomInitValue = <V = any>(
    atom: Atom<V>,
    data: StoreData,
    initializedAtomsSet: Set<Atom>,
) => {
    if (atom.defaultValue === undefined) {
        // Reuse a live placeholder (re-init after unset/reset) so the reader
        // already suspended on it is the one a later write resolves.
        const outstanding = pendingDefaultPromise(atom, data)
        if (outstanding) return outstanding
        let resolve!: (value: any) => void
        const promise = new Promise(r => {
            resolve = r
        })
        data.pendingDefaults.set(atom, { promise, resolve })
        return promise
    } else if (typeof atom.defaultValue === "function") {
        // @ts-expect-error -- generic V may itself be callable, so typeof cannot isolate the default factory union member
        const value = atom.defaultValue()
        if (isPromiseLike(value)) {
            value.then(
                resolvedValue => {
                    if (isStoreDisposed(data)) return
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
                        commitFunctionDefaultCleanup(
                            admitFunctionDefaultTransition(
                                atom,
                                resolvedValue,
                                value,
                                data,
                                undefined,
                                undefined,
                            ),
                            atom,
                            resolvedValue,
                            value,
                            data,
                            undefined,
                            undefined,
                        )
                        return
                    }
                    const admitted = admitFunctionDefaultTransition(
                        atom,
                        resolvedValue,
                        value,
                        data,
                        undefined,
                        undefined,
                    )
                    if (!hasAtomCommitObservers(atom, data)) {
                        commitFunctionDefaultResolution(
                            admitted,
                            atom,
                            resolvedValue,
                            value,
                            data,
                            undefined,
                            undefined,
                        )
                        return
                    }
                    runCommitPlan({
                        data,
                        settlement: updateSettlement(
                            data,
                            [atom],
                            settleCommit,
                            SETTLE_DEFAULT,
                        ),
                        admit: () =>
                            admitFunctionDefaultTransition(
                                atom,
                                resolvedValue,
                                value,
                                data,
                                undefined,
                                undefined,
                            ),
                        apply: () =>
                            applyFunctionDefaultResolution(
                                atom,
                                resolvedValue,
                                value,
                                data,
                                undefined,
                                undefined,
                            ),
                        onSets: NO_ON_SETS,
                        errors: createCommitErrors(),
                        report: "async-set",
                    })
                },
                () => {
                    // On rejection, remove the rejected promise from the
                    // store so that re-subscribing triggers a fresh init
                    // rather than being stuck with a rejected promise.
                    commitFunctionDefaultCleanup(
                        admitFunctionDefaultTransition(
                            atom,
                            undefined,
                            value,
                            data,
                            undefined,
                            undefined,
                        ),
                        atom,
                        undefined,
                        value,
                        data,
                        undefined,
                        undefined,
                    )
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
                    resolved => {
                        if (!isStoreDisposed(data)) {
                            validateResolvedValue(atom, resolved, data)
                        }
                    },
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
    let tmpVal
    try {
        tmpVal = getAtomInitValue(atom, data, initializedAtomsSet)
    } catch (error) {
        // A stale value may have been evicted immediately before this
        // re-initialization. Keep failure cleanup off the steady store.get()
        // path while ensuring historical direct-atom state is not retained.
        untrackNamedAtom(atom, data)
        throw error
    }
    setValueInData(atom, tmpVal, data)
    // Cold-path bookkeeping for dehydrate. Resolve registration through the
    // reverse WeakMap instead of probing the optional `name` property: besides
    // being the registry's source of truth, this keeps unnamed atoms on Bun's
    // original property-access shape for subsequent hot reads.
    trackNamedState(atom, data)
    const onInit = (atom as InternalAtom<Value>).onInit
    if (onInit)
        onInit((newVal: Value) => {
            if (isStoreDisposed(data)) return
            // Seed the store's own value only: no onSet hook, no global
            // fan-out (a global atom's onInit setSelf must not re-broadcast).
            setAtom(atom, newVal, data, SEED_WRITE)
        }, data)
}
