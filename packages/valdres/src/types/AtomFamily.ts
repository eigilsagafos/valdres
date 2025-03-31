import type { AtomFamilyAtom } from "./AtomFamilyAtom"
import type { EqualFunc } from "./EqualFunc"

export type AtomFamily<
    Value extends any,
    Args extends [any, ...any[]] = [any, ...any[]],
> = {
    (...args: Args): AtomFamilyAtom<Value, Args>
    release: (...args: Args) => void
    equal: EqualFunc<Value>
    name?: string
    __valdresAtomFamilyMap: Map<Value, AtomFamilyAtom<Value, Args>>
}
