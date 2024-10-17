import { useContext } from "react"
import { type Store } from "valdres"
import { StoreContext } from "./lib/StoreContext"

export const useStore = (id?: string): Store => {
    // @ts-ignore
    const [currentId, stores] = useContext(StoreContext)
    const store = stores[id || currentId]
    if (!store) throw new Error(`No store with id ${id || currentId} found`)
    return stores[id || currentId]
}
