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

    // Note: jotai-style onMount `(setSelf) => cleanup` is converted to
    // valdres-style `(store, state) => cleanup` at atom creation time via
    // the onMount interceptor in atom.ts. No wrapping needed here.
    return store
}
