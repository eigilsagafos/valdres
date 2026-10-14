import { useContext } from "react"
import type { Store } from "./types/jotai"
import { getDefaultStore } from "./getDefaultStore"
import { StoreContext } from "./lib/StoreContext"

type Options = {
    store?: Store
}

export const useStore = (options?: Options): Store => {
    const store = useContext(StoreContext)
    return options?.store || store || getDefaultStore()
}
