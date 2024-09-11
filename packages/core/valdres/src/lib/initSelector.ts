import equal from "fast-deep-equal"
import { isPromiseLike } from "../utils/isPromiseLike"
import { getState } from "./getState"
import { updateStateSubscribers } from "./updateStateSubscribers"
import type { StoreData } from "../types/StoreData"
import type { State } from "../types/State"
import type { Selector } from "../types/Selector"

class SuspendAndWaitForResolveError extends Error {
    promise: Promise<any>
    constructor(promise: Promise) {
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
    const currentDependencies =
        data.stateDependencies.get(selector) ?? new Set<State<any>>()
    const updatedDependencies = new Set<State<any>>()
    // const currentListeners =
    //     store.listeners.get(selector) ?? new Set<State<any>>()
    // const updatedListeners = new Set<State<any>>()
    let result
    try {
        result = selector.get(state => {
            const value = getState(state, data)
            updatedDependencies.add(state)
            if (isPromiseLike(value))
                throw new SuspendAndWaitForResolveError(value)
            return value
        })
    } catch (error) {
        if (error instanceof SuspendAndWaitForResolveError) {
            result = error
        } else {
            throw error
        }
    }
    const added = updatedDependencies?.difference(currentDependencies)
    const removed = currentDependencies?.difference(updatedDependencies)
    for (const state of added) {
        const set = getOrInitConsumersSet(state, data)
        set.add(selector)
    }
    for (const state of removed) {
        const set = getOrInitConsumersSet(state, data)
        set.delete(selector)
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
        console.log(`test this path. What should be the right behavior?`)
    } else {
        data.values.set(selector, updatedValue)
    }
    // console.log(`reEvaluateSelector`,currentValue, updatedValue)
    // return true
}

export const initSelector = <V>(selector: Selector<V>, data: StoreData): V => {
    const value = evaluateSelector(selector, data)

    if (value instanceof SuspendAndWaitForResolveError) {
        value.promise.then(() => initSelector(selector, data))
        data.values.set(selector, value.promise)
        return value.promise
    } else if (isPromiseLike(value)) {
        // When a promise is returned when initializing a selector we suspend,
        // then we retry when the promise resolves.
        // console.log(`initSelector isPromiseLike`, { selector, value })
        value.then(resolved => {
            // console.log(`initSelector isPromiseLike then`, {
            //     resolved,
            //     selector,
            //     value,
            // })
            data.values.set(selector, resolved)
            updateStateSubscribers(selector, data)
            console.log(
                `TODO: Should we check if other selectors are using this?`,
            )
        })
        data.values.set(selector, value)
        return value
    } else {
        data.values.set(selector, value)
        return value
    }
}
