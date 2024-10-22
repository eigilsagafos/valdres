import type { SelectorFamily } from "./SelectorFamily"
import type { AtomFamily } from "./AtomFamily"

export type Family<Key, Value = any> =
    | AtomFamily<Key, Value>
    | SelectorFamily<Key, Value>
