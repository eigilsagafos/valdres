import type { Store } from "./types/jotai"
import { createStore } from "./createStore"

// Like Jotai, provider-less mode uses one store per copy of this module. It is
// owned by the compatibility layer; Valdres core has no default Store.
let defaultStore: Store | undefined

export const getDefaultStore = (): Store => (defaultStore ??= createStore())
