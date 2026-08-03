import type { Atom } from "../types/Atom"
import type { DirectWriteIntent } from "../types/CommitIntent"
import type { StoreData } from "../types/StoreData"
import { isGlobalAtom } from "../utils/isGlobalAtom"
import { createScalarCommit, runCommitPlan } from "./commitEngine"
import { createCommitErrors } from "./commitErrors"
import { SETTLE_DEFAULT } from "./commitIntents"
import {
    globalEffects,
    forestSettlement,
    globalWriteQueue,
    NO_ON_SETS,
    singleStoreForest,
    updateSettlement,
} from "./commitPlans"
import { applyGlobalSets } from "./globalAtomFanOut"
import { hasAtomCommitObservers } from "./hasAtomCommitObservers"
import { settleCommit, settleCommitForest } from "./propagateUpdatedAtoms"
import { resolvePendingDefault } from "./resolvePendingDefault"
import { setValueInData } from "./setValueInData"
import { isStoreDisposed } from "./storeLifecycle"
import { unsetValue } from "./unsetValue"
import { validateResolvedValue } from "./validateResolvedValue"

const admitAsyncAtomTransition = <Value>(
    atom: Atom<Value>,
    _nextValue: Value,
    promise: Promise<Value>,
    data: StoreData,
    _fallback: Value,
    _unused: undefined,
): boolean => !isStoreDisposed(data) && data.values.get(atom) === promise

const applyAsyncAtomResolution = <Value>(
    atom: Atom<Value>,
    resolvedValue: Value,
    _promise: Promise<Value>,
    data: StoreData,
    _fallback: Value,
    _unused: undefined,
) => {
    setValueInData(atom, resolvedValue, data)
    resolvePendingDefault(atom, data, resolvedValue)
}

const applyAsyncAtomRollback = <Value>(
    atom: Atom<Value>,
    _nextValue: Value,
    _promise: Promise<Value>,
    data: StoreData,
    fallback: Value,
    _unused: undefined,
) => {
    setValueInData(atom, fallback, data)
}

// Keep observed and unobserved scalar transitions in separate static
// operations. A shared boolean settlement branch is trained as always-false by
// the unobserved path, then deoptimizes when an observed settlement arrives on
// some V8 tiers. Distinct coordinator entries keep both shapes monomorphic.
const commitObservedAsyncAtomResolution = <Value>(
    atom: Atom<Value>,
    resolvedValue: Value,
    _promise: Promise<Value>,
    data: StoreData,
    _fallback: Value,
    _unused: undefined,
) => {
    setValueInData(atom, resolvedValue, data)
    resolvePendingDefault(atom, data, resolvedValue)
    settleCommit([atom], data, undefined, "async-set", SETTLE_DEFAULT)
}

const commitObservedAsyncAtomRollback = <Value>(
    atom: Atom<Value>,
    _nextValue: Value,
    _promise: Promise<Value>,
    data: StoreData,
    fallback: Value,
    _unused: undefined,
) => {
    setValueInData(atom, fallback, data)
    settleCommit([atom], data, undefined, "async-set", SETTLE_DEFAULT)
}

const runUnobservedAsyncAtomResolution = createScalarCommit(
    applyAsyncAtomResolution,
)
const runObservedAsyncAtomResolution = createScalarCommit(
    commitObservedAsyncAtomResolution,
)
const runUnobservedAsyncAtomRollback = createScalarCommit(
    applyAsyncAtomRollback,
)
const runObservedAsyncAtomRollback = createScalarCommit(
    commitObservedAsyncAtomRollback,
)

const rollbackAsyncAtomTransition = <Value>(
    atom: Atom<Value>,
    currentValue: Value,
    promise: Promise<Value>,
    data: StoreData,
    rollbackInheritedWrite: boolean,
) => {
    const admitted = admitAsyncAtomTransition(
        atom,
        currentValue,
        promise,
        data,
        currentValue,
        undefined,
    )
    if (!admitted) return
    if (rollbackInheritedWrite) {
        // Promise reactions run in registration order. Defer the unset one
        // turn so the ancestor coordinator gets to restore its own fallback
        // first even when a cross-scope transaction registered this child
        // coordinator before the parent's (writes are leaf-first).
        queueMicrotask(() => {
            if (isStoreDisposed(data)) return
            if (data.values.get(atom) === promise) unsetValue(atom, data)
        })
        return
    }
    if (hasAtomCommitObservers(atom, data)) {
        runObservedAsyncAtomRollback(
            admitted,
            atom,
            currentValue,
            promise,
            data,
            currentValue,
            undefined,
        )
    } else {
        runUnobservedAsyncAtomRollback(
            admitted,
            atom,
            currentValue,
            promise,
            data,
            currentValue,
            undefined,
        )
    }
}

/** Keep the Promise fulfillment reaction itself tiny. This module-static
 * coordinator is shared by every async write, allowing V8 to optimize observed
 * settlement independently of the per-write closure that preserves rejection
 * and Promise-identity behavior. */
const settleAsyncAtomResolution = <Value>(
    atom: Atom<Value>,
    resolvedValue: Value,
    promise: Promise<Value>,
    data: StoreData,
    currentValue: Value,
    intent: DirectWriteIntent,
    rollback: () => void,
) => {
    // Last write wins, not last Promise to settle.
    if (
        !admitAsyncAtomTransition(
            atom,
            resolvedValue,
            promise,
            data,
            currentValue,
            undefined,
        )
    )
        return
    // Async validation cannot throw back to the original caller. Report the
    // error and restore the value observed before this write.
    if (!validateResolvedValue(atom, resolvedValue, data)) {
        rollback()
        return
    }
    const hasOnSet = !!atom.onSet && intent.effects === "run"
    if (!hasOnSet) {
        const admitted = admitAsyncAtomTransition(
            atom,
            resolvedValue,
            promise,
            data,
            currentValue,
            undefined,
        )
        if (hasAtomCommitObservers(atom, data)) {
            runObservedAsyncAtomResolution(
                admitted,
                atom,
                resolvedValue,
                promise,
                data,
                currentValue,
                undefined,
            )
        } else {
            runUnobservedAsyncAtomResolution(
                admitted,
                atom,
                resolvedValue,
                promise,
                data,
                currentValue,
                undefined,
            )
        }
        return
    }

    const errors = createCommitErrors()
    const isGlobal = hasOnSet && isGlobalAtom(atom)
    if (isGlobal) {
        // One atom, one store: the ordered global sets and the deferred onSet
        // queue describe the same write, so they share one descriptor queue.
        const queue = globalWriteQueue(atom, resolvedValue, data)
        runCommitPlan({
            data,
            settlement: forestSettlement(
                data,
                singleStoreForest(data, [atom]),
                globalEffects(data, queue, "async-set", applyGlobalSets),
                settleCommitForest,
            ),
            admit: () =>
                admitAsyncAtomTransition(
                    atom,
                    resolvedValue,
                    promise,
                    data,
                    currentValue,
                    undefined,
                ),
            apply: () => {
                applyAsyncAtomResolution(
                    atom,
                    resolvedValue,
                    promise,
                    data,
                    currentValue,
                    undefined,
                )
            },
            onSets: queue,
            errors,
            report: "async-set",
        })
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
            admitAsyncAtomTransition(
                atom,
                resolvedValue,
                promise,
                data,
                currentValue,
                undefined,
            ),
        apply: () => {
            applyAsyncAtomResolution(
                atom,
                resolvedValue,
                promise,
                data,
                currentValue,
                undefined,
            )
        },
        onSets: hasOnSet ? [[atom, resolvedValue, data]] : NO_ON_SETS,
        errors,
        report: "async-set",
    })
}

/**
 * Install and settle one asynchronous atom write.
 *
 * Both the direct set path and transaction commits route through here so
 * Promise-like normalization, stale-write protection, rollback, resolved-value
 * validation, onSet timing, suspense resolution, and propagation stay in lockstep.
 * Callers remain responsible for the initial propagation of the pending value.
 */
export const coordinateAsyncWrite = <Value>(
    atom: Atom<Value>,
    value: PromiseLike<Value>,
    currentValue: Value,
    data: StoreData,
    intent: DirectWriteIntent,
): Promise<Value> => {
    // Promise.resolve(realPromise) preserves the reference; bare thenables are
    // normalized so the chained rejection handler below is always available.
    const promise = Promise.resolve(value)
    // An explicit scope write can equal the Promise it currently inherits. It
    // still pins a local shadow, but if that Promise fails there is no settled
    // fallback to pin; restore the pre-write structure by re-inheriting instead.
    const rollbackInheritedWrite =
        !!data.parent && !data.values.has(atom) && currentValue === value
    if (isGlobalAtom(atom) && intent.effects === "run") atom.attach(data)
    setValueInData(atom, promise as Value, data)
    const rollback = () =>
        rollbackAsyncAtomTransition(
            atom,
            currentValue,
            promise,
            data,
            rollbackInheritedWrite,
        )
    promise
        .then(resolvedValue =>
            settleAsyncAtomResolution(
                atom,
                resolvedValue,
                promise,
                data,
                currentValue,
                intent,
                rollback,
            ),
        )
        // Chaining catch also contains errors from the fulfilled handler (for
        // example, an onSet hook throwing) instead of leaking an unhandled
        // rejection. Only an unresolved current write is eligible for rollback.
        .catch(rollback)
    return promise
}
