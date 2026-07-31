import type { AtomOnInit } from "./AtomOnInit"
import type { GlobalAtom } from "./GlobalAtom"
import type { StoreData } from "./StoreData"
import type { CacheController } from "./CacheController"

/** Engine-only global atom state; never exported from the package entrypoint. */
export type InternalGlobalAtom<Value = unknown> = GlobalAtom<Value> & {
    onInit: AtomOnInit<Value>
    attach: (storeData: StoreData) => void
    detach: (storeData: StoreData) => void
    readonly stores: Set<StoreData>
    cacheController?: CacheController
}
