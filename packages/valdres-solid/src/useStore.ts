import { useContext } from "solid-js"
import { StoreContext } from "./lib/storeContext"
import type { Store } from "valdres"

export const useStore = (id?: string): Store => {
    const ctx = useContext(StoreContext)
    if (!ctx) {
        throw new Error(
            "No valdres store found. Wrap your component tree with <ValdresProvider>.",
        )
    }
    if (id) {
        const store = ctx.stores[id]
        if (!store) {
            throw new Error(`No store with id "${id}" found in ancestor chain`)
        }
        return store
    }
    return ctx.current
}
