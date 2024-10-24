import { useContext } from "react"
import { type Store } from "valdres"
import { StoreContext } from "./lib/StoreContext"

export const useStore = (id?: string): Store => {
    const [currentStore, allStores] = useContext(StoreContext)
    if (!currentStore) throw new Error("No <Provider> found")
    if (id) {
        const store = allStores[id]
        if (!store) throw new Error(`No store with id ${id} found`)
        return store
    }
    return currentStore
}
