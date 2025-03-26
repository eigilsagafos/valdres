import type { AtomFamilyAtom } from "./AtomFamilyAtom"
import type { GlobalAtom } from "./GlobalAtom"

export type AtomFamilyGlobalAtom<
    Value extends any,
    Args extends [any, ...any[]] = [any, ...any[]],
> = AtomFamilyAtom<Value, Args> & GlobalAtom<Value>
