import { createStoreWithSelectorSet as valdresCreateStore } from "valdres"

const isPromiseLike = (value: any): value is Promise<any> =>
    value && typeof value.then === "function"

export const createStore = () => {
    const store = valdresCreateStore()

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

    const originalSub = store.sub
    // Wraps onMount so that jotai-style `(setAtom) => cleanup` is converted to
    // valdres-style `(store, state) => cleanup` during the subscribe call.
    // Uses the outer store (which supports selector set) for setAtom.
    store.sub = (state, callback) => {
        if (state.onMount) {
            const jotaiOnMount = state.onMount
            state.onMount = (_innerStore, _state) => {
                const setAtom = (...args) => store.set(_state, ...args)
                return jotaiOnMount(setAtom)
            }
            try {
                return originalSub(state, callback)
            } finally {
                state.onMount = jotaiOnMount
            }
        }
        return originalSub(state, callback)
    }
    return store
}
