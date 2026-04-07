import { createStore } from "./createStore"

const setDefaultStore = () => {
    const store = createStore("default")
    globalThis._valdresJotaiDefaultStore = store
    return store
}

export const getDefaultStore = () => {
    return globalThis._valdresJotaiDefaultStore || setDefaultStore()
}
