import type { FamilyKey } from "./FamilyKey"
import type { Selector } from "./Selector"

export type SelectorFamily<Key = FamilyKey, Value = unknown> = {
    (key: Key, defaultOverride?: any): Selector<Value>
    __valdresSelectorFamilyMap: Map<Key, Selector<Value, Key>>
}
