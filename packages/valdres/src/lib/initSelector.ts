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
    const set = data.stateConsumers.get(state)
    if (set) return set
    const newSet = new Set<State>()
    data.stateConsumers.set(state, newSet)
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
    value: Value | SuspendAndWaitForResolveError,
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
): V | Promise<V> => {
    let tmpValue
    try {
        tmpValue = evaluateSelector(selector, data, circularDependencySet)
    } catch (e) {
        if (e instanceof SelectorEvaluationError) e.track(selector)
        throw e
    }
    const value = handleSelectorResult<V>(tmpValue, selector, data)
    if (data.expiredValues.has(selector)) {
        const expiredValue = data.expiredValues.get(selector)
        // @ts-ignore
        if (selector.equal(expiredValue, value)) {
            return setValueInData(selector, expiredValue, data)
        }
    }
    // @ts-ignore
    return setValueInData(selector, value, data)
}
