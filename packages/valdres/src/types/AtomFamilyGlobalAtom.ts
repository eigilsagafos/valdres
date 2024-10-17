import type { AtomFamilyAtom } from "./AtomFamilyAtom"
import type { GlobalAtomSetSelfFunc } from "./GlobalAtomSetSelfFunc"

export type AtomFamilyGlobalAtom<
    Value = unknown,
    Key = unknown,
> = AtomFamilyAtom<Value, Key> & {
    setSelf: GlobalAtomSetSelfFunc<Value>
}
