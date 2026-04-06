import {
    createStoreWithSelectorSet as valdresCreateStore,
    isPromiseLike,
} from "valdres"
import { registerStore } from "./storeRegistry"

export const createStore = () => {
    const store = valdresCreateStore()

    // Register for setSelf lookup (selectors use data.id to find the store)
    registerStore(store.data.id, store)

    // Jotai always returns Promises for async atoms. Valdres unwraps resolved
    // values, so we re-wrap them to match jotai semantics.
    const originalGet = store.get
    store.get = (state: any) => {
        const value = originalGet(state)
        if (state.__jotaiAsync && !isPromiseLike(value)) {
            return Promise.resolve(value)
        }
        return value
    }

    // For async atoms, suppress subscription notifications while the value
    // is still a Promise (i.e., during promise-to-promise transitions). Jotai
    // only notifies subscribers when the async atom settles to a resolved value.
    const originalSub = store.sub
    store.sub = (state: any, callback: () => void, ...rest: any[]) => {
        if (state.__jotaiAsync) {
            const wrappedCallback = () => {
                const value = originalGet(state)
                if (isPromiseLike(value)) return
                callback()
            }
            return originalSub(state, wrappedCallback, ...rest)
        }
        return originalSub(state, callback, ...rest)
    }

    // Note: jotai-style onMount `(setSelf) => cleanup` is converted to
    // valdres-style `(store, state) => cleanup` at atom creation time via
    // the onMount interceptor in atom.ts. No wrapping needed here.
    return store
}
