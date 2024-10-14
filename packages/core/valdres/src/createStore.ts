import { createStoreData } from "./lib/createStoreData"
import { storeFromStoreData } from "./lib/storeFromStoreData"

export const createStore = (id?: string) => {
    const data = createStoreData(id)
    return storeFromStoreData(data)
}
