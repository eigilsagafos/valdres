import { createContext } from "react"
import type { Store } from "valdres"

export type ProviderContext = [string, { [id: string]: Store }]
export const StoreContext = createContext<ProviderContext | undefined>(
    undefined,
)
