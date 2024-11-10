import { createStoreWithSelectorSet } from "valdres"

const setDefaultStore = () => {
    const store = createStoreWithSelectorSet("default")
    globalThis._valdresJotaiDefaultStore = store
    return store
}

export const getDefaultStore = () => {
    return globalThis._valdresJotaiDefaultStore || setDefaultStore()
}
