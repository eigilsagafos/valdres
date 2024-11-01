import type { AtomFamilyAtom } from "./AtomFamilyAtom"
import type { GlobalAtom } from "./GlobalAtom"

export type AtomFamilyGlobalAtom<
    Key = unknown,
    Value = unknown,
> = AtomFamilyAtom<Key, Value> & GlobalAtom<Value>
