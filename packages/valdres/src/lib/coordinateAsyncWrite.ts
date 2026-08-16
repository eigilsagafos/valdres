import type { Atom } from "../types/Atom"
import type { DirectWriteIntent } from "../types/CommitIntent"
import type { StoreData } from "../types/StoreData"
import { isGlobalAtom } from "../utils/isGlobalAtom"
import { isPromiseLike } from "../utils/isPromiseLike"
import {
    clearAsyncAtomCoordinatorEntry,
    getAsyncAtomCoordinatorEntry,
    setAsyncAtomCoordinatorEntry,
    type AsyncAtomCoordinatorEntry,
} from "./asyncAtomCoordinatorRegistry"
import { applyResolvedAsyncAtomValue } from "./applyResolvedAsyncAtomValue"
import { createScalarCommit, runCommitPlan } from "./commitEngine"
import { createCommitErrors } from "./commitErrors"
import { SETTLE_DEFAULT } from "./commitIntents"
import {
    createCommitPlan,
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
import { setValueInData } from "./setValueInData"
import { isStoreDisposed } from "./storeLifecycle"
import { unsetValue } from "./unsetValue"
import { validateResolvedValue } from "./validateResolvedValue"

type AsyncAtomCoordinator = AsyncAtomCoordinatorEntry & {
    rearm: () => void
    stranded: boolean
}

const getAsyncAtomCoordinator = (
    atom: Atom<any>,
    value: PromiseLike<any>,
    data: StoreData,
): AsyncAtomCoordinator | undefined =>
    getAsyncAtomCoordinatorEntry(atom, value, data) as
        | AsyncAtomCoordinator
        | undefined

const installAsyncAtomCoordinator = (
    atom: Atom<any>,
    data: StoreData,
    coordinator: AsyncAtomCoordinator,
) => {
    setAsyncAtomCoordinatorEntry(atom, data, coordinator)
}

const clearAsyncAtomCoordinator = (
    atom: Atom<any>,
    data: StoreData,
    coordinator: AsyncAtomCoordinator,
) => clearAsyncAtomCoordinatorEntry(atom, data, coordinator)

/** A denied reaction is stranded only when a newer coordinated Promise owns
 * the slot and may later roll back to it. Sync supersession and disposal leave
 * no future restore path, so their stale entry is simply retired. */
const strandOrClearAsyncAtomCoordinator = (
    atom: Atom<any>,
    data: StoreData,
    coordinator: AsyncAtomCoordinator,
) => {
    const currentValue = data.values.get(atom)
    const current = isPromiseLike(currentValue)
        ? getAsyncAtomCoordinator(atom, currentValue, data)
        : undefined
    // A different entry means a newer coordinated Promise captured this
    // transition. No entry means sync supersession, disposal, or retirement.
    if (current && current !== coordinator) coordinator.stranded = true
    clearAsyncAtomCoordinator(atom, data, coordinator)
}

const admitAsyncAtomTransition = <Value>(
    atom: Atom<Value>,
    _nextValue: Value,
    promise: PromiseLike<Value>,
    data: StoreData,
    _fallback: Value,
    _unused: undefined,
): boolean => !isStoreDisposed(data) && data.values.get(atom) === promise

const applyAsyncAtomResolution = <Value>(
    atom: Atom<Value>,
    resolvedValue: Value,
    _promise: PromiseLike<Value>,
    data: StoreData,
    _fallback: Value,
    _unused: undefined,
) => {
    applyResolvedAsyncAtomValue(atom, resolvedValue, data)
}

const applyAsyncAtomRollback = <Value>(
    atom: Atom<Value>,
    _nextValue: Value,
    _promise: PromiseLike<Value>,
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
    _promise: PromiseLike<Value>,
    data: StoreData,
    _fallback: Value,
    _unused: undefined,
) => {
    applyResolvedAsyncAtomValue(atom, resolvedValue, data)
    settleCommit([atom], data, undefined, "async-set", SETTLE_DEFAULT)
}

const commitObservedAsyncAtomRollback = <Value>(
    atom: Atom<Value>,
    _nextValue: Value,
    _promise: PromiseLike<Value>,
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

const createFallbackCoordinator = (
    atom: Atom<any>,
    promise: PromiseLike<any>,
    data: StoreData,
): AsyncAtomCoordinator => {
    let coordinator!: AsyncAtomCoordinator
    const rollback = () =>
        rollbackFallbackTransition(atom, promise, data, coordinator)
    coordinator = {
        promise,
        stranded: false,
        rearm: () => {
            Promise.resolve(promise)
                .then(resolvedValue =>
                    settleFallbackResolution(
                        atom,
                        resolvedValue,
                        promise,
                        data,
                        coordinator,
                        rollback,
                    ),
                )
                .catch(rollback)
        },
    }
    return coordinator
}

const rollbackFallbackTransition = (
    atom: Atom<any>,
    promise: PromiseLike<any>,
    data: StoreData,
    coordinator: AsyncAtomCoordinator,
) => {
    const admitted = admitAsyncAtomTransition(
        atom,
        undefined,
        promise,
        data,
        undefined,
        undefined,
    )
    if (!admitted) {
        strandOrClearAsyncAtomCoordinator(atom, data, coordinator)
        return
    }
    clearAsyncAtomCoordinator(atom, data, coordinator)
    unsetValue(atom, data)
}

const rollbackAsyncAtomTransition = <Value>(
    atom: Atom<Value>,
    currentValue: Value,
    promise: Promise<Value>,
    data: StoreData,
    rollbackInheritedWrite: boolean,
    fallbackCoordinator: AsyncAtomCoordinator | undefined,
    coordinator: AsyncAtomCoordinator,
) => {
    const admitted = admitAsyncAtomTransition(
        atom,
        currentValue,
        promise,
        data,
        currentValue,
        undefined,
    )
    if (!admitted) {
        strandOrClearAsyncAtomCoordinator(atom, data, coordinator)
        return
    }
    if (rollbackInheritedWrite) {
        // Promise reactions run in registration order. Defer the unset one
        // turn so the ancestor coordinator gets to restore its own fallback
        // first even when a cross-scope transaction registered this child
        // coordinator before the parent's (writes are leaf-first).
        queueMicrotask(() => {
            if (isStoreDisposed(data)) {
                clearAsyncAtomCoordinator(atom, data, coordinator)
                return
            }
            if (data.values.get(atom) === promise) {
                clearAsyncAtomCoordinator(atom, data, coordinator)
                unsetValue(atom, data)
            } else {
                strandOrClearAsyncAtomCoordinator(atom, data, coordinator)
            }
        })
        return
    }

    const restoredCoordinator =
        fallbackCoordinator ??
        (isPromiseLike(currentValue)
            ? createFallbackCoordinator(atom, currentValue, data)
            : undefined)
    if (restoredCoordinator) {
        // Publish coordinator identity before rollback propagation: a subscriber
        // may synchronously supersede the restored Promise and must be able to
        // capture its settlement behavior as the next fallback.
        installAsyncAtomCoordinator(atom, data, restoredCoordinator)
        if (!fallbackCoordinator || restoredCoordinator.stranded) {
            restoredCoordinator.stranded = false
            restoredCoordinator.rearm()
        }
    } else {
        clearAsyncAtomCoordinator(atom, data, coordinator)
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
const settleFallbackResolution = (
    atom: Atom<any>,
    resolvedValue: any,
    promise: PromiseLike<any>,
    data: StoreData,
    coordinator: AsyncAtomCoordinator,
    rollback: () => void,
) => {
    if (
        !admitAsyncAtomTransition(
            atom,
            resolvedValue,
            promise,
            data,
            resolvedValue,
            undefined,
        )
    ) {
        strandOrClearAsyncAtomCoordinator(atom, data, coordinator)
        return
    }
    if (!validateResolvedValue(atom, resolvedValue, data)) {
        rollback()
        return
    }
    const admitted = admitAsyncAtomTransition(
        atom,
        resolvedValue,
        promise,
        data,
        resolvedValue,
        undefined,
    )
    const observed = hasAtomCommitObservers(atom, data)
    const applied = observed
        ? runObservedAsyncAtomResolution(
              admitted,
              atom,
              resolvedValue,
              promise,
              data,
              resolvedValue,
              undefined,
          )
        : runUnobservedAsyncAtomResolution(
              admitted,
              atom,
              resolvedValue,
              promise,
              data,
              resolvedValue,
              undefined,
          )
    if (applied) clearAsyncAtomCoordinator(atom, data, coordinator)
    if (!applied) strandOrClearAsyncAtomCoordinator(atom, data, coordinator)
}

const settleAsyncAtomResolution = <Value>(
    atom: Atom<Value>,
    resolvedValue: Value,
    promise: Promise<Value>,
    data: StoreData,
    currentValue: Value,
    intent: DirectWriteIntent,
    rollback: () => void,
    coordinator: AsyncAtomCoordinator,
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
    ) {
        strandOrClearAsyncAtomCoordinator(atom, data, coordinator)
        return
    }
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
        const observed = hasAtomCommitObservers(atom, data)
        const applied = observed
            ? runObservedAsyncAtomResolution(
                  admitted,
                  atom,
                  resolvedValue,
                  promise,
                  data,
                  currentValue,
                  undefined,
              )
            : runUnobservedAsyncAtomResolution(
                  admitted,
                  atom,
                  resolvedValue,
                  promise,
                  data,
                  currentValue,
                  undefined,
              )
        if (applied) clearAsyncAtomCoordinator(atom, data, coordinator)
        if (!applied) strandOrClearAsyncAtomCoordinator(atom, data, coordinator)
        return
    }

    const errors = createCommitErrors()
    const isGlobal = hasOnSet && isGlobalAtom(atom)
    if (isGlobal) {
        // One atom, one store: the ordered global sets and the deferred onSet
        // queue describe the same write, so they share one descriptor queue.
        const queue = globalWriteQueue(atom, resolvedValue, data)
        const applied = runCommitPlan(
            createCommitPlan(
                data,
                forestSettlement(
                    data,
                    singleStoreForest(data, [atom]),
                    globalEffects(data, queue, "async-set", applyGlobalSets),
                    settleCommitForest,
                ),
                queue,
                errors,
                "async-set",
                undefined,
                () =>
                    admitAsyncAtomTransition(
                        atom,
                        resolvedValue,
                        promise,
                        data,
                        currentValue,
                        undefined,
                    ),
                () => {
                    applyAsyncAtomResolution(
                        atom,
                        resolvedValue,
                        promise,
                        data,
                        currentValue,
                        undefined,
                    )
                },
            ),
        )
        if (applied) clearAsyncAtomCoordinator(atom, data, coordinator)
        if (!applied) strandOrClearAsyncAtomCoordinator(atom, data, coordinator)
        return
    }
    const applied = runCommitPlan(
        createCommitPlan(
            data,
            updateSettlement(data, [atom], settleCommit, SETTLE_DEFAULT),
            hasOnSet ? [[atom, resolvedValue, data]] : NO_ON_SETS,
            errors,
            "async-set",
            undefined,
            () =>
                admitAsyncAtomTransition(
                    atom,
                    resolvedValue,
                    promise,
                    data,
                    currentValue,
                    undefined,
                ),
            () => {
                applyAsyncAtomResolution(
                    atom,
                    resolvedValue,
                    promise,
                    data,
                    currentValue,
                    undefined,
                )
            },
        ),
    )
    if (applied) clearAsyncAtomCoordinator(atom, data, coordinator)
    if (!applied) strandOrClearAsyncAtomCoordinator(atom, data, coordinator)
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
    const fallbackCoordinator = isPromiseLike(currentValue)
        ? getAsyncAtomCoordinator(atom, currentValue, data)
        : undefined
    // An explicit scope write can equal the Promise it currently inherits. It
    // still pins a local shadow, but if that Promise fails there is no settled
    // fallback to pin; restore the pre-write structure by re-inheriting instead.
    const rollbackInheritedWrite =
        !!data.parent && !data.values.has(atom) && currentValue === value
    if (isGlobalAtom(atom) && intent.effects === "run") atom.attach(data)
    setValueInData(atom, promise as Value, data)
    let coordinator!: AsyncAtomCoordinator
    const rollback = () =>
        rollbackAsyncAtomTransition(
            atom,
            currentValue,
            promise,
            data,
            rollbackInheritedWrite,
            fallbackCoordinator,
            coordinator,
        )
    coordinator = {
        promise,
        stranded: false,
        rearm: () => {
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
                        coordinator,
                    ),
                )
                // Contain genuine rejection and errors from a fulfilled
                // settlement. Admission keeps an already-applied transition
                // from being rolled back by a later phase error.
                .catch(rollback)
        },
    }
    installAsyncAtomCoordinator(atom, data, coordinator)
    coordinator.rearm()
    return promise
}
