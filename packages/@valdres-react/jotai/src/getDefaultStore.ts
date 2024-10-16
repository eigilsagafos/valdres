import { createStoreWithSelectorSet } from "valdres-react"

const setDefaultStore = () => {
    const store = createStoreWithSelectorSet("default")
    globalThis._valdresJotaiDefaultStore = store
    return store
}

export const getDefaultStore = () => {
    return globalThis._valdresJotaiDefaultStore || setDefaultStore()
}
