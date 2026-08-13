import { createStoreData } from "./lib/createStoreData"
import { storeFromStoreData } from "./lib/storeFromStoreData"
import type { Store } from "./types/Store"
import type { StoreOptions } from "./types/StoreOptions"

// The positional-id form takes `StoreOptions` minus `id`: with the id already
// given as the first argument, a second one in the bag would be two answers to
// the same question. Spelled as `Omit<StoreOptions, "id">` rather than the
// internal `CreateStoreDataOptions` alias so the emitted signature references
// only names a consumer can import from the package root.
export function store(id?: string, options?: Omit<StoreOptions, "id">): Store
export function store(options?: StoreOptions): Store
export function store(
    idOrOptions?: string | StoreOptions,
    maybeOptions?: Omit<StoreOptions, "id">,
) {
    // First arg is the options object only when it's actually an object; a
    // string id or an omitted/undefined first arg means options (if any) come
    // from the second arg — so `store(undefined, { enumerable: true })` works.
    const optionsObject =
        typeof idOrOptions === "object" && idOrOptions !== null
            ? idOrOptions
            : undefined
    const id = typeof idOrOptions === "string" ? idOrOptions : optionsObject?.id
    const options = optionsObject ?? maybeOptions
    const data = createStoreData(id, undefined, options)
    return storeFromStoreData(data)
}
