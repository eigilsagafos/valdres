import { createStoreData } from "./lib/createStoreData"
import { storeFromStoreData } from "./lib/storeFromStoreData"

export const store = (id?: string) => {
    const data = createStoreData(id)
    return storeFromStoreData(data)
}
