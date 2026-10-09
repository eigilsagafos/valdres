import { createContext, type Context } from "react"
import type { Store } from "valdres"

/** The Store owned by the nearest `<RecoilRoot>`. */
export const RecoilStoreContext: Context<Store | undefined> = createContext<
    Store | undefined
>(undefined)
