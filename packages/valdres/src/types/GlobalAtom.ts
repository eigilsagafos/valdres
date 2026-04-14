import type { Atom } from "./Atom"
import type { GlobalAtomGetSelfFunc } from "./GlobalAtomGetSelfFunc"
import type { GlobalAtomResetSelfFunc } from "./GlobalAtomResetSelfFunc"
import type { GlobalAtomSetSelfFunc } from "./GlobalAtomSetSelfFunc"
import type { StoreData } from "./StoreData"

export type MaxAgeInterval = {
    cleanup: () => void
    refCount: number
}

export type GlobalAtom<Value = unknown> = Atom<Value> & {
    setSelf: GlobalAtomSetSelfFunc<Value>
    resetSelf: GlobalAtomResetSelfFunc
    getSelf: GlobalAtomGetSelfFunc<Value>
    detach: (storeData: StoreData) => void
    stores: Set<StoreData>
    maxAgeInterval?: MaxAgeInterval
}
