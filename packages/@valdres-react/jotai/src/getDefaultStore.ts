import { createStore } from "./createStore"

declare global {
    var _valdresJotaiDefaultStore: ReturnType<typeof createStore> | undefined
}

const setDefaultStore = () => {
    const store = createStore("default")
    globalThis._valdresJotaiDefaultStore = store
    return store
}

export const getDefaultStore = () => {
    return globalThis._valdresJotaiDefaultStore || setDefaultStore()
}
