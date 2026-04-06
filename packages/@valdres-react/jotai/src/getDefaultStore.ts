import { createStoreWithSelectorSet } from "valdres"
import { registerStore } from "./storeRegistry"

const setDefaultStore = () => {
    const store = createStoreWithSelectorSet("default")
    registerStore(store.data.id, store)
    globalThis._valdresJotaiDefaultStore = store
    return store
}

export const getDefaultStore = () => {
    return globalThis._valdresJotaiDefaultStore || setDefaultStore()
}
