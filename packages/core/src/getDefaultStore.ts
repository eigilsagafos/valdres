import { createStore } from "./createStore"

// let defaultStore = createStore("default")

if (!globalThis._valdresStore) {
    globalThis._valdresStore = createStore("default")
}

export const getDefaultStore = () => globalThis._valdresStore
export const resetDefaultStore = () =>
    (globalThis._valdresStore = createStore())
