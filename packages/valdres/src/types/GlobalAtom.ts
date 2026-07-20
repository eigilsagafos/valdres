import type { Atom } from "./Atom"
import type { GlobalAtomGetSelfFunc } from "./GlobalAtomGetSelfFunc"
import type { GlobalAtomResetSelfFunc } from "./GlobalAtomResetSelfFunc"
import type { GlobalAtomSetSelfFunc } from "./GlobalAtomSetSelfFunc"

export type GlobalAtom<Value = unknown> = Atom<Value> & {
    setSelf: GlobalAtomSetSelfFunc<Value>
    resetSelf: GlobalAtomResetSelfFunc
    getSelf: GlobalAtomGetSelfFunc<Value>
}
