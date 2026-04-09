import { inject } from "vue"
import type { Store } from "valdres"
import { StoreKey } from "./lib/storeKey"

export const useStore = (): Store => {
    const store = inject(StoreKey)
    if (!store) throw new Error("No ValdresPlugin installed or no store provided")
    return store
}
