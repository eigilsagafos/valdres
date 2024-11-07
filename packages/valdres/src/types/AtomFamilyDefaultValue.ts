import type { Selector } from "./Selector"
import type { SelectorFamily } from "./SelectorFamily"

type DefaultValueCallback<Key, Value> = (arg: Key) => Value | Promise<Value>

export type AtomFamilyDefaultValue<Key, Value> =
    | undefined
    | Value
    | DefaultValueCallback<Key, Value>
    | Selector<Value>
    | SelectorFamily<Key, Value>
