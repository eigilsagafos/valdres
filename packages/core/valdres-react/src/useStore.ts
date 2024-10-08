import { useContext } from "react"
import { getDefaultStore, type Store } from "valdres"
import { StoreContext, type ProviderContext } from "./lib/StoreContext"

export const useStore = (id?: string): Store => {
    const [currentId, stores] =
        useContext(StoreContext) ||
        ([
            "default",
            {
                default: getDefaultStore(),
            },
        ] as ProviderContext)
    const store = stores[id || currentId]
    if (!store) throw new Error(`No store with id ${id || currentId} found`)
    return stores[id || currentId]
}
