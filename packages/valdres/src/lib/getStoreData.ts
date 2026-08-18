import type { Store } from "../types/Store"
import type { StoreData } from "../types/StoreData"
import { STORE_DATA_ACCESS } from "./storeDataAccessToken"
import { valdresGlobal } from "./valdresGlobal"

/** Engine/test access to the opaque Store backing data. Not package-exported. */
export const getStoreData = (store: Store): StoreData => {
    // Same-version package copies share the globalStore facade, but each copy's
    // STORE_DATA_ACCESS capability is private. The slot carries the companion
    // StoreData explicitly so every adopted copy's utilities can use it.
    const sharedGlobalStore = valdresGlobal().runtime.globalStore
    if (sharedGlobalStore?.store === store) return sharedGlobalStore.data
    return (
        store.txn as unknown as (token: typeof STORE_DATA_ACCESS) => StoreData
    )(STORE_DATA_ACCESS)
}
