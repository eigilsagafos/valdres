import type { Store } from "../types/Store"
import type { StoreData } from "../types/StoreData"
import { createStoreData } from "./createStoreData"
import { storeFromStoreData } from "./storeFromStoreData"
import { valdresGlobal } from "./valdresGlobal"

const disposeGlobalStore = (): never => {
    throw new Error(
        "valdres: globalStore is process-wide and cannot be disposed",
    )
}

const runtime = valdresGlobal().runtime
if (runtime.globalStore === undefined) {
    const data = createStoreData("valdres-global-store")
    const store = Object.assign(storeFromStoreData(data), {
        dispose: disposeGlobalStore,
    })
    runtime.globalStore = { store, data }
}

export const globalStoreRuntime: { store: Store; data: StoreData } =
    runtime.globalStore
