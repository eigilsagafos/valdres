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
    // First arg is the options object only when it's actually an object; a
    // string id or an omitted/undefined first arg means options (if any) come
    // from the second arg — so `store(undefined, { enumerable: true })` works.
    const optionsObject =
        typeof idOrOptions === "object" && idOrOptions !== null
            ? idOrOptions
            : undefined
    const id =
        typeof idOrOptions === "string" ? idOrOptions : optionsObject?.id
    const options = optionsObject ?? maybeOptions
    const data = createStoreData(id, undefined, options)
    return storeFromStoreData(data)
}
