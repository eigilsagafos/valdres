import type { Store } from "../types/Store"
import type { StoreData } from "../types/StoreData"
import { STORE_RUNTIME } from "./storeRuntimeKey"

/** Resolve the canonical public facade without touching the facade registry. */
export const getStoreRuntime = (data: StoreData): Store => {
    const runtime = (data as StoreData & { [STORE_RUNTIME]?: Store })[
        STORE_RUNTIME
    ]
    if (!runtime)
        throw new Error("valdres: store runtime has not been initialized")
    return runtime
}
