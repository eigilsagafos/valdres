import { SelectorCircularDependencyError } from "../errors/SelectorCircularDependencyError"
import { SelectorEvaluationError } from "../errors/SelectorEvaluationError"
import type { Atom } from "../types/Atom"
import type { Selector } from "../types/Selector"
import type { State } from "../types/State"
import type { StoreData } from "../types/StoreData"
import { isPromiseLike } from "../utils/isPromiseLike"
import { getState } from "./getState"
import {
    propagateDirtySelectors,
    propagateUpdatedAtoms,
} from "./propagateUpdatedAtoms"
import { setValueInData } from "./setValueInData"
class SuspendAndWaitForResolveError extends Error {
    promise: Promise<any>
    constructor(promise: Promise<any>) {
        super()
        this.promise = promise
    }
}

const getOrInitDependentsSet = (
    state: State,
    data: StoreData,
): Set<State<any>> => {
    const set = data.stateDependents.get(state)
    if (set) return set
    const newSet = new Set<State>()
    data.stateDependents.set(state, newSet)
    return newSet
}

export const evaluateSelector = <V>(
    selector: Selector<V>,
    data: StoreData,
    initializedAtomsSet: Set<Atom>,
    circularDependencySet = new WeakSet(),
) => {
    const updatedDependencies = new Set<State<any>>()
    if (circularDependencySet.has(selector)) {
        throw new SelectorCircularDependencyError()
    }

    circularDependencySet.add(selector)

    let result
    try {
        // @ts-ignore, @ts-todo
        result = selector.get(state => {
            const value = getState(
                state,
                data,
                initializedAtomsSet,
                circularDependencySet,
            )
            updatedDependencies.add(state)
            if (isPromiseLike(value))
                throw new SuspendAndWaitForResolveError(value)

            return value
        }, data.id)
    } catch (error) {
        if (error instanceof SuspendAndWaitForResolveError) {
            result = error
        } else if (error instanceof SelectorEvaluationError) {
            throw error
        } else {
            throw new SelectorEvaluationError(error)
        }
    }

    const currentDependencies =
        data.stateDependencies.get(selector) ?? new Set<State<any>>()
    const added = updatedDependencies?.difference(currentDependencies)
    const removed = currentDependencies?.difference(updatedDependencies)
    for (const state of added) {
        const set = getOrInitDependentsSet(state, data)
        // if (set.size === 0 && state.onConsume) {
        //     const res = state.onConsume()
        // }
        set.add(selector)
    }
    for (const state of removed) {
        const set = getOrInitDependentsSet(state, data)
        set.delete(selector)
        // if (set.size === 0 && state.onConsume) {
        //     throw new Error(`TODO`)
        // }
    }

    data.stateDependencies.set(selector, updatedDependencies)
    return result
}

const handleSelectorResult = <Value>(
    value: Value | Promise<Value> | SuspendAndWaitForResolveError,
    selector: Selector<Value>,
    data: StoreData,
) => {
    if (value instanceof SuspendAndWaitForResolveError) {
        value.promise.then(() => {
            const initializedAtomsSet = new Set<Atom>()
            const res = initSelector(selector, data, initializedAtomsSet)
            if (initializedAtomsSet.size > 0) {
                propagateUpdatedAtoms([...initializedAtomsSet], data)
            }
            return res
        })
        return value.promise
    } else if (isPromiseLike(value)) {
        // When a promise is returned when initializing a selector we suspend,
        // then we retry when the promise resolves.
        value.then(resolved => {
            // @ts-ignore
            setValueInData(selector, resolved, data)
            const dependents = data.stateDependents.get(selector)
            const subs = data.subscriptions.get(selector)
            if (
                (subs && subs.size > 0) ||
                (dependents && dependents.size > 0)
            ) {
                propagateDirtySelectors(
                    [],
                    new Set(dependents),
                    data,
                    new Set(subs),
                    new Map(),
                )
            }
            // if (subs && subs.size > 0) {
            //     throw new Error("TODO")
            // }
            // if (dependents && dependents.size > 0) {
            //     throw new Error("TODO")
            // }
        })
        return value
    } else {
        return value
    }
}

export const initSelector = <V>(
    selector: Selector<V>,
    data: StoreData,
    initializedAtomsSet: Set<Atom>,
    circularDependencySet = new WeakSet(),
): boolean => {
    const existingValue = data.values.get(selector)
    const udpatedValue = evaluate(
        selector,
        data,
        initializedAtomsSet,
        circularDependencySet,
    )

    if (selector.equal(existingValue as V, udpatedValue as V)) {
        return false
    } else {
        setValueInData<V>(selector, udpatedValue as V, data)
        return true
    }

    // if (data.expiredValues.has(selector)) {
    //     /**
    //      * In this case we want to first check if any dependencies changed before we re-validate.
    //      * The way valdres works is that when an atom changes we mark the entire dependency tree of
    //      * that atom as "dirty" by moving the value into expired values. We should therefore ensure
    //      * that all dirty parents are re-evaluted first and then only trigger the re-evalute if any
    //      * of the dependencies changes.
    //      */
    //     const dependecies = data.stateDependencies.get(selector)
    //     if (dependecies?.size) {
    //         let shouldReEvalute = false
    //         let reason
    //         for (const dependecy of dependecies) {
    //             if (shouldReEvalute) break
    //             if (data.values.has(dependecy)) {
    //                 shouldReEvalute = true
    //                 reason = ["has dep", dependecy]
    //             } else if (data.expiredValues.has(dependecy)) {
    //                 const didChange = initSelector(
    //                     dependecy,
    //                     data,
    //                     circularDependencySet,
    //                 )
    //                 if (didChange) {
    //                     shouldReEvalute = true
    //                 }
    //             } else {
    //                 shouldReEvalute = true
    //             }
    //         }

    //         if (shouldReEvalute) {
    //             const newValue = evaluate(selector, data, circularDependencySet)
    //             const expiredValue = data.expiredValues.get(selector)
    //             if (selector.equal(expiredValue, newValue)) {
    //                 setValueInData(selector, expiredValue, data)
    //                 return false
    //             } else {
    //                 setValueInData(selector, newValue, data)
    //                 return true
    //             }
    //         } else {
    //             const expiredValue = data.expiredValues.get(selector)
    //             setValueInData(selector, expiredValue, data)
    //             return false
    //         }
    //     } else {
    //         throw new Error("TODO")
    //     }
    // } else {
    //     if (data.values.has(selector)) {
    //         throw new Error("TODO")
    //     }
    //     const value = evaluate(selector, data, circularDependencySet)
    //     setValueInData(selector, value, data)
    //     return true
    // }
}

const evaluate = <V>(
    selector: Selector<V>,
    data: StoreData,
    initializedAtomsSet: Set<Atom>,
    circularDependencySet: WeakSet<any>,
) => {
    let tmpValue
    try {
        tmpValue = evaluateSelector(
            selector,
            data,
            initializedAtomsSet,
            circularDependencySet,
        )
    } catch (e) {
        if (e instanceof SelectorEvaluationError) e.track(selector)
        throw e
    }
    return handleSelectorResult<V>(tmpValue, selector, data)
}
