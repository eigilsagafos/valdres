import type { Atom } from "./Atom"
import type { GlobalAtomSetSelfFunc } from "./GlobalAtomSetSelfFunc"
import type { GlobalAtomResetSelfFunc } from "./GlobalAtomResetSelfFunc"

export type GlobalAtom<Value = unknown> = Atom<Value> & {
    setSelf: GlobalAtomSetSelfFunc<Value>
    resetSelf: GlobalAtomResetSelfFunc
}
