import { inject } from "vue"
import { ValdresKey } from "./lib/storeKey"
import type { Store } from "valdres"

export const useStore = (id?: string): Store => {
    const ctx = inject(ValdresKey)
    if (!ctx) throw new Error("No valdres store provided. Install createValdres() as a plugin or wrap in a ValdresScope.")
    if (id) {
        const store = ctx.stores[id]
        if (!store) throw new Error(`No store with id "${id}" found in ancestor chain`)
        return store
    }
    return ctx.current
}
