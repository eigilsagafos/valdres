import { useContext } from "react"
import { StoreContext } from "./lib/StoreContext"
import { getDefaultStore, type Store } from "@valdres/core"

export const useValdresStore = (): Store =>
    useContext(StoreContext) || getDefaultStore()
