import {
    atom as valdresAtom,
    selector as valdresSelector,
    isSuspendError,
} from "valdres"
import { getStoreById } from "./storeRegistry"

const addSetToSelector = (selector, set) => {
    selector.set = (valdresSet, valdresGet, reset, ...args) => {
        return set(valdresGet, valdresSet, ...args)
    }
}

// Adds an onMount getter/setter that converts jotai-style `(setSelf) => cleanup`
// to valdres-style `(store, state) => cleanup` when assigned. This ensures the
// conversion happens at assignment time, so valdres core can call onMount directly
// during propagation (not just during store.sub).
//
// The getter returns the original jotai function (so mock assertions work),
// while `__valdresOnMount` holds the converted function used by valdres core.
const addOnMountInterceptor = (target: any) => {
    let _jotaiOnMount: any = undefined
    Object.defineProperty(target, "onMount", {
        get() {
            return _jotaiOnMount
        },
        set(jotaiOnMount) {
            _jotaiOnMount = jotaiOnMount
            if (typeof jotaiOnMount !== "function") {
                target.__valdresOnMount = jotaiOnMount
                return
            }
            target.__valdresOnMount = (innerStore: any, state: any) => {
                const setSelf = (...args: any[]) =>
                    innerStore.set(state, ...args)
                return jotaiOnMount(setSelf)
            }
        },
        configurable: true,
        enumerable: true,
    })
    return target
}

const isAsyncFunction = (fn: Function) =>
    Object.prototype.toString.call(fn) === "[object AsyncFunction]"

// Wraps an async read function so that `get(asyncDep)` during the sync phase
// returns the Promise instead of throwing SuspendAndWaitForResolveError.
// After the sync phase, core's `lateGet` handles deferred deps natively.
const wrapAsync = (fn: Function) => {
    if (!isAsyncFunction(fn)) return { get: fn, isAsync: false }
    return {
        get: (get: any, options: any) => {
            const wrappedGet = (dep: any) => {
                try {
                    return get(dep)
                } catch (e: any) {
                    if (isSuspendError(e)) {
                        return e.promise
                    }
                    throw e
                }
            }
            return fn(wrappedGet, options)
        },
        isAsync: true,
    }
}

export const atom = (get, set?: any) => {
    if (typeof get === "function") {
        const wrapped = wrapAsync(get)
        const selector = valdresSelector(wrapped.get, { equal: Object.is })
        if (set) {
            addSetToSelector(selector, set)
            // Replace .get to supply jotai-style { setSelf } as the second
            // argument to the read function. `selector` is already defined
            // at this point, so the closure reference is safe.
            selector.get = (coreGet: any, coreOptions: any) => {
                const store = getStoreById(coreOptions?.storeId ?? coreOptions)
                const options: any = {}
                if (coreOptions?.signal) {
                    options.signal = coreOptions.signal
                }
                if (store) {
                    options.setSelf = (...args: any[]) =>
                        store.set(selector, ...args)
                }
                return wrapped.get(coreGet, options)
            }
        }
        if (wrapped.isAsync) selector.__jotaiAsync = true
        return addOnMountInterceptor(selector)
    } else if (typeof set === "function") {
        if (get === null) {
            // Write-only atom: atom(null, writeFn)
            const selector = valdresSelector(() => null, {
                equal: Object.is,
            })
            addSetToSelector(selector, set)
            return addOnMountInterceptor(selector)
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
        return addOnMountInterceptor(selector)
    } else {
        const newAtom = valdresAtom(get, { equal: Object.is })
        return addOnMountInterceptor(newAtom)
    }
}
