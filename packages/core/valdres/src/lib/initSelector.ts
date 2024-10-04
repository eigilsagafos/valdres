import equal from "fast-deep-equal"
import { isPromiseLike } from "../utils/isPromiseLike"
import { getState } from "./getState"
import { updateStateSubscribers } from "./updateStateSubscribers"
import type { StoreData } from "../types/StoreData"
import type { State } from "../types/State"
import type { Selector } from "../types/Selector"

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

const evaluateSelector = <V>(selector: Selector<V>, data: StoreData) => {
    const updatedDependencies = new Set<State<any>>()

    let result
    try {
        result = selector.get(state => {
            // @ts-ignore, @ts-todo
            const value = getState(state, data)
            // @ts-ignore, @ts-todo
            updatedDependencies.add(state)
            if (isPromiseLike(value))
                throw new SuspendAndWaitForResolveError(value)

            return value
        }, data.id)
    } catch (error) {
        if (error instanceof SuspendAndWaitForResolveError) {
            result = error
        } else {
            throw error
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

export const reEvaluateSelector = <V>(
    selector: Selector<V>,
    data: StoreData,
): void => {
    const currentValue = data.values.get(selector)
    const updatedValue = evaluateSelector(selector, data)
    if (equal(currentValue, updatedValue)) return
    if (isPromiseLike(updatedValue)) {
        console.log("ReEvaluate - promise", {
            selector,
            currentValue,
            updatedValue,
        })
        // throw new Error(`TODO`)
        updatedValue.then(resolved => {
            data.values.set(selector, resolved)
        })
        console.log("test this path. What should be the right behavior?")
    } else {
        data.values.set(selector, updatedValue)
    }
    // console.log(`reEvaluateSelector`,currentValue, updatedValue)
    // return true
}

const handleSelectorResult = <Value>(
    value: Value | SuspendAndWaitForResolveError,
    selector: Selector<Value>,
    data: StoreData,
) => {
    if (value instanceof SuspendAndWaitForResolveError) {
        value.promise.then(() => initSelector(selector, data))
        // data.values.set(selector, value.promise)
        return value.promise
    } else if (isPromiseLike(value)) {
        // When a promise is returned when initializing a selector we suspend,
        // then we retry when the promise resolves.
        // console.log(`initSelector isPromiseLike`, { selector, value })
        value.then(resolved => {
            data.values.set(selector, resolved)
            updateStateSubscribers(selector, data)
            console.log("Should we reEvaluate?")
            // reEvaluateSelector(selector, data)
        })
        return value
    } else {
        return value
    }
}

export const initSelector = <V>(
    selector: Selector<V>,
    data: StoreData,
): V | Promise<V> => {
    const tmpValue = evaluateSelector(selector, data)
    const value = handleSelectorResult<V>(tmpValue, selector, data)
    if (data.expiredValues.has(selector)) {
        const expiredValue = data.expiredValues.get(selector)
        if (equal(expiredValue, value)) {
            data.values.set(selector, expiredValue)
            return expiredValue
        }
    }
    data.values.set(selector, value)
    return value
}
