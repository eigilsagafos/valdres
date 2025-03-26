import type { Selector } from "./Selector"
import type { SelectorFamily } from "./SelectorFamily"

type DefaultValueCallback<Value extends any, Args extends [any, ...any[]]> = (
    ...args: Args
) => Value | Promise<Value>

export type AtomFamilyDefaultValue<
    Value extends any,
    Args extends [any, ...any[]],
> =
    | undefined
    | Value
    | DefaultValueCallback<Value, Args>
    | Selector<Value, Args>
    | SelectorFamily<Value, Args>
