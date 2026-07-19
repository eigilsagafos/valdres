import type { Atom } from "./Atom"
import type { AtomFamily } from "./AtomFamily"
import type { Selector } from "./Selector"

type UnsuscribeFn = () => void

export type SubscribeFn = {
    <Value extends any, Args extends [any, ...any[]] = [any, ...any[]]>(
        state: AtomFamily<Value, Args>,
        callback: (...args: Args) => void,
        requireDeepEqualCheckBeforeCallback?: boolean,
    ): UnsuscribeFn
    <Value extends any>(
        state: Atom<Value> | Selector<Value>,
        callback: () => void,
        requireDeepEqualCheckBeforeCallback?: boolean,
    ): UnsuscribeFn
}
