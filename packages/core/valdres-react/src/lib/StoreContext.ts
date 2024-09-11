import { createContext } from "react"
import type { Store } from "../types/Store"

export const StoreContext = createContext<Store | undefined>(undefined)
