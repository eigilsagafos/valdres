import { createStoreData } from "./lib/createStoreData"
import { storeFromStoreData } from "./lib/storeFromStoreData"
import type { Store } from "./types/Store"

export const createStore = (id?: string): Store => {
    const data = createStoreData(id)
    return storeFromStoreData(data)
}
