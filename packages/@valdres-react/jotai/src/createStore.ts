import { createStoreWithSelectorSet as valdresCreateStore } from "valdres"

export const createStore = () => {
    const store = valdresCreateStore()
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
            const unsub = originalSub(state, callback)
            state.onMount = jotaiOnMount
            return unsub
        }
        return originalSub(state, callback)
    }
    return store
}
