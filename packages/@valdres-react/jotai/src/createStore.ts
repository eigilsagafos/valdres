import {
    createStoreWithSelectorSet as valdresCreateStore,
    isPromiseLike,
} from "valdres"
import { registerStore } from "./storeRegistry"

export const createStore = (id?: string) => {
    const store = valdresCreateStore(id)

    // Register for setSelf lookup (selectors use data.id to find the store)
    registerStore(store.data.id, store)

    // Save the unwrapped get for React hooks — useValue uses store.get()
    // internally, and returning Promise.resolve() breaks useSyncExternalStore
    // (new Promise object each call → infinite re-render, plus Suspense throws
    // on any Promise value including resolved ones).
    const rawGet = store.get

    // Jotai's store.get() returns a Promise for async atoms even after
    // resolution. Valdres unwraps resolved values, so we re-wrap them.
    store.get = (state: any) => {
        const value = rawGet(state)
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
                const value = rawGet(state)
                if (isPromiseLike(value)) return
                callback()
            }
            return originalSub(state, wrappedCallback, ...rest)
        }
        return originalSub(state, callback, ...rest)
    }

    // Expose rawGet so React hooks can bypass the Promise re-wrapping
    ;(store as any)._rawGet = rawGet

    // Note: jotai-style onMount `(setSelf) => cleanup` is converted to
    // valdres-style `(store, state) => cleanup` at atom creation time via
    // the onMount interceptor in atom.ts. No wrapping needed here.
    return store
}
