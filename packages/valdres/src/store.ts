import { createStoreData, type CreateStoreDataOptions } from "./lib/createStoreData"
import { storeFromStoreData } from "./lib/storeFromStoreData"
import type { Store } from "./types/Store"

type StoreOptions = CreateStoreDataOptions & {
    id?: string
}

export function store(id?: string, options?: CreateStoreDataOptions): Store
export function store(options?: StoreOptions): Store
export function store(
    idOrOptions?: string | StoreOptions,
    maybeOptions?: CreateStoreDataOptions,
) {
    const id = typeof idOrOptions === "string" ? idOrOptions : idOrOptions?.id
    const options =
        typeof idOrOptions === "string"
            ? maybeOptions
            : (idOrOptions as StoreOptions | undefined)
    const data = createStoreData(id, undefined, options)
    return storeFromStoreData(data)
}
