import { atom as valdresAtom, selector as valdresSelector } from "valdres"

const addSetToSelector = (selector, set) => {
    selector.set = (valdresSet, valdresGet, reset, ...args) => {
        return set(valdresGet, valdresSet, ...args)
    }
}

const isAsyncFunction = (fn: Function) =>
    Object.prototype.toString.call(fn) === "[object AsyncFunction]"

// Wraps an async read function into a sync function that returns a Promise,
// since valdres selectors do not accept async functions directly.
const wrapAsync = (fn: Function) => {
    if (!isAsyncFunction(fn)) return { get: fn, isAsync: false }
    return { get: (...args: any[]) => fn(...args), isAsync: true }
}

export const atom = (get, set?: any) => {
    if (typeof get === "function") {
        const wrapped = wrapAsync(get)
        const selector = valdresSelector(wrapped.get, { equal: Object.is })
        if (set) addSetToSelector(selector, set)
        if (wrapped.isAsync) selector.__jotaiAsync = true
        return selector
    } else if (typeof set === "function") {
        if (get === null) {
            // Write-only atom: atom(null, writeFn)
            const selector = valdresSelector(() => undefined, {
                equal: Object.is,
            })
            addSetToSelector(selector, set)
            return selector
        }
        // Writable primitive atom: atom(value, writeFn)
        // Uses a backing valdres atom for mutable storage, with a selector that reads
        // from it. Self-sets (set(thisAtom, val)) are redirected to the backing atom.
        const backingAtom = valdresAtom(get, { equal: Object.is })
        const selector = valdresSelector(g => g(backingAtom), {
            equal: Object.is,
        })
        selector.set = (valdresSet, valdresGet, _reset, ...args) => {
            const wrappedSet = (target: any, ...setArgs: any[]) => {
                if (target === selector) {
                    return valdresSet(backingAtom, ...setArgs)
                }
                return valdresSet(target, ...setArgs)
            }
            return set(valdresGet, wrappedSet, ...args)
        }
        return selector
    } else {
        const newAtom = valdresAtom(get, { equal: Object.is })
        return newAtom
    }
}
