import { isPromiseLike } from "../utils/isPromiseLike"
import { getState } from "./getState"
import { updateStateSubscribers } from "./updateStateSubscribers"
import { SelectorCircularDependencyError } from "../errors/SelectorCircularDependencyError"
import type { StoreData } from "../types/StoreData"
import type { State } from "../types/State"
import type { Selector } from "../types/Selector"
import { SelectorEvaluationError } from "../errors/SelectorEvaluationError"
import { setValueInData } from "./setValueInData"

class SuspendAndWaitForResolveError extends Error {
    promise: Promise<any>
    constructor(promise: Promise<any>) {
        super()
        this.promise = promise
    }
}

const getOrInitConsumersSet = (
    state: State,
    data: StoreData,
): Set<State<any>> => {
    const set = data.stateDependents.get(state)
    if (set) return set
    const newSet = new Set<State>()
    data.stateDependents.set(state, newSet)
    return newSet
}

const evaluateSelector = <V>(
    selector: Selector<V>,
    data: StoreData,
    circularDependencyMap = new WeakSet(),
) => {
    const updatedDependencies = new Set<State<any>>()
    if (circularDependencyMap.has(selector)) {
        throw new SelectorCircularDependencyError()
    }

    circularDependencyMap.add(selector)

    let result
    try {
        // @ts-ignore, @ts-todo
        result = selector.get(state => {
            const value = getState(state, data, circularDependencyMap)
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
        const set = getOrInitConsumersSet(state, data)
        // if (set.size === 0 && state.onConsume) {
        //     const res = state.onConsume()
        // }
        set.add(selector)
    }
    for (const state of removed) {
        const set = getOrInitConsumersSet(state, data)
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
        value.promise.then(() => initSelector(selector, data))
        return value.promise
    } else if (isPromiseLike(value)) {
        // When a promise is returned when initializing a selector we suspend,
        // then we retry when the promise resolves.
        // console.log(`initSelector isPromiseLike`, { selector, value })
        value.then(resolved => {
            // @ts-ignore
            setValueInData(selector, resolved, data)
            updateStateSubscribers(selector, data)
            console.log("Should we reEvaluate?")
        })
        return value
    } else {
        return value
    }
}

export const initSelector = <V>(
    selector: Selector<V>,
    data: StoreData,
    circularDependencySet = new WeakSet(),
): boolean => {
    const existingValue = data.values.get(selector)
    const udpatedValue = evaluate(selector, data, circularDependencySet)
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

    //         if (process.env.DEBUG1) {
    //             console.log("asdf", {
    //                 selector,
    //                 hasExpired: data.expiredValues.has(selector),
    //                 shouldReEvalute,
    //                 reason,
    //             })
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
    circularDependencySet: WeakSet<any>,
) => {
    let tmpValue
    try {
        tmpValue = evaluateSelector(selector, data, circularDependencySet)
    } catch (e) {
        if (e instanceof SelectorEvaluationError) e.track(selector)
        throw e
    }
    return handleSelectorResult<V>(tmpValue, selector, data)
}
