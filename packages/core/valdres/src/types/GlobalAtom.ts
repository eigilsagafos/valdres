import type { Atom } from "./Atom"
import type { GlobalAtomSetSelfFunc } from "./GlobalAtomSetSelfFunc"

export type GlobalAtom<Value = unknown> = Atom<Value> & {
    setSelf: GlobalAtomSetSelfFunc<Value>
}
