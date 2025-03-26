import type { SelectorFamily } from "./SelectorFamily"
import type { AtomFamily } from "./AtomFamily"

export type Family<
    Value extends any,
    Args extends [any, ...any[]] = [any, ...any[]],
> = AtomFamily<Value, Args> | SelectorFamily<Value, Args>
