import { createStore } from "./createStore"

// @ts-ignore
if (!globalThis._valdresStore) {
    // @ts-ignore
    globalThis._valdresStore = createStore("default")
}

// @ts-ignore
export const getDefaultStore = () => globalThis._valdresStore
export const resetDefaultStore = () =>
    // @ts-ignore
    (globalThis._valdresStore = createStore())
