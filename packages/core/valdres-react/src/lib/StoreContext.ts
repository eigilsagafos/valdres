import { createContext } from "react"
import type { Store } from "valdres"

export const StoreContext = createContext<Store | undefined>(undefined)
