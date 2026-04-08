import { createStoreData, type CreateStoreDataOptions } from "./lib/createStoreData"
import { storeFromStoreData } from "./lib/storeFromStoreData"

type StoreOptions = CreateStoreDataOptions & {
    id?: string
}

export const store = (idOrOptions?: string | StoreOptions) => {
    const id = typeof idOrOptions === "string" ? idOrOptions : idOrOptions?.id
    const options = typeof idOrOptions === "object" ? idOrOptions : undefined
    const data = createStoreData(id, undefined, options)
    return storeFromStoreData(data)
}
