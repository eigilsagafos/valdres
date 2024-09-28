import { useContext } from "react"
import { getDefaultStore, type Store } from "valdres"
import { StoreContext } from "./lib/StoreContext"

export const useStore = (): Store =>
    useContext(StoreContext) || getDefaultStore()
