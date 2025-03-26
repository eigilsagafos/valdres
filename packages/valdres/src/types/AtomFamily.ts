import type { Atom } from "./Atom"
import type { AtomFamilyAtom } from "./AtomFamilyAtom"
import type { Selector } from "./Selector"

export type AtomFamily<
    Value extends any,
    Args extends [any, ...any[]] = [any, ...any[]],
> = {
    (...args: Args): AtomFamilyAtom<Value, Args>
    release: (...args: Args) => void
    name?: string
    __valdresAtomFamilyMap: Map<Value, AtomFamilyAtom<Value, Args>>
    __keysAtom: Atom<Set<Args>>
    __keysSelector: Selector<Args[]>
}
