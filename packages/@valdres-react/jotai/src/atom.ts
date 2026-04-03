import { atom as valdresAtom, selector as valdresSelector } from "valdres"

const addSetToSelector = (selector, set) => {
    selector.set = (valdresSet, valdresGet, reset, ...args) => {
        return set(valdresGet, valdresSet, ...args)
    }
}

const isAsyncFunction = (fn: Function) =>
    fn.constructor.name === "AsyncFunction"

// Wraps an async read function into a sync function that returns a Promise,
// since valdres selectors do not accept async functions directly.
const wrapAsync = (fn: Function) => {
    if (!isAsyncFunction(fn)) return { get: fn, isAsync: false }
    return { get: (...args: any[]) => fn(...args), isAsync: true }
}

export const atom = (get, set?: any) => {
    if (typeof get === "function" && get.length === 1) {
        const wrapped = wrapAsync(get)
        const selector = valdresSelector(wrapped.get, { equal: Object.is })
        if (set) addSetToSelector(selector, set)
        if (wrapped.isAsync) selector.__jotaiAsync = true
        return selector
    } else if (typeof set === "function") {
        if (get === null) get = () => undefined
        const wrapped = wrapAsync(get)
        const selector = valdresSelector(wrapped.get, { equal: Object.is })
        if (set) addSetToSelector(selector, set)
        if (wrapped.isAsync) selector.__jotaiAsync = true
        return selector
    } else {
        const newAtom = valdresAtom(get, { equal: Object.is })
        // if (set) addSetToSelector(newAtom, set)
        return newAtom
    }
}
