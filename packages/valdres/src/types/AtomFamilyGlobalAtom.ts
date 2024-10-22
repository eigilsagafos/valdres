import type { AtomFamilyAtom } from "./AtomFamilyAtom"
import type { GlobalAtomSetSelfFunc } from "./GlobalAtomSetSelfFunc"

export type AtomFamilyGlobalAtom<
    Key = unknown,
    Value = unknown,
> = AtomFamilyAtom<Key, Value> & {
    setSelf: GlobalAtomSetSelfFunc<Value>
}
