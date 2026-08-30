import { createContext, type Context } from "react"
import type { Store } from "valdres"

export const StoreContext: Context<Store | undefined> = createContext<
    Store | undefined
>(undefined)
