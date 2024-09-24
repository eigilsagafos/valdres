import type { Selector } from "./Selector"

export type SelectorFamily<Value, Key> = {
    (key: Key, defaultOverride?: any): Selector<Value>
    _map: Map<Key, Selector<Value, Key>>
}
