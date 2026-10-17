import type { Store } from "./types/jotai"
import { StoreRuntime } from "./lib/runtime"

export const createStore = (): Store => new StoreRuntime().api
