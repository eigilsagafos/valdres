import { globalStoreRuntime } from "./lib/globalStoreRuntime"
import type { Store } from "./types/Store"

export const globalStore: Store = globalStoreRuntime.store
