import type { Atom } from "./Atom"
import type { AtomFamily } from "./AtomFamily"

export type AtomFamilyAtom<
    Value extends any,
    Args extends [any, ...any[]] = [any, ...any[]],
> = Atom<Value> & {
    family: AtomFamily<Value, Args>
    familyKey: Args
}
