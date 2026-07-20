import type { Store } from "../types/Store"
import type { StoreData } from "../types/StoreData"
import { STORE_DATA_ACCESS } from "./storeDataAccessToken"

/** Engine/test access to the opaque Store backing data. Not package-exported. */
export const getStoreData = (store: Store): StoreData =>
    (store.txn as unknown as (token: typeof STORE_DATA_ACCESS) => StoreData)(
        STORE_DATA_ACCESS,
    )
