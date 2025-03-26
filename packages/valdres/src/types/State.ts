import type { Atom } from "./Atom"
import type { AtomFamily } from "./AtomFamily"
import type { Selector } from "./Selector"

export type State<
    Value extends any = any,
    Args extends [any, ...any[]] = [any, ...any[]],
> = Atom<Value> | Selector<Value> | AtomFamily<Value, Args>
