import type { Atom } from "./Atom"
import type { AtomFamily } from "./AtomFamily"
import type { AtomFamilyAtom } from "./AtomFamilyAtom"
import type { Selector } from "./Selector"

export type GetValue = {
    <Value extends any>(atom: Atom<Value>): Value
    <Value extends any, Args extends [any, ...any[]] = [any, ...any[]]>(
        selector: Selector<Value, Args>,
    ): Value
    <Value extends any, Args extends [any, ...any[]]>(
        family: AtomFamily<Value, Args>,
    ): AtomFamilyAtom<Value, Args>[]
}
