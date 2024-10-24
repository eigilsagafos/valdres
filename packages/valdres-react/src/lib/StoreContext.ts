import { createContext } from "react"
import type { Store } from "valdres"

export type ProviderContext = [Store | undefined, { [id: string]: Store }]
export const StoreContext = createContext<ProviderContext>([undefined, {}])
