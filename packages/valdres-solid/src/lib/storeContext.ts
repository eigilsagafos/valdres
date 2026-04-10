import { createContext } from "solid-js"
import type { Store } from "valdres"

export interface ValdresContext {
    current: Store
    stores: Record<string, Store>
}

export const StoreContext = createContext<ValdresContext>()
