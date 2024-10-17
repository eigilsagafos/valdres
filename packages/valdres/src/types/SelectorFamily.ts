import type { Selector } from "./Selector"

export type SelectorFamily<Value = any, Key = any> = {
    (key: Key, defaultOverride?: any): Selector<Value>
    __valdresSelectorFamilyMap: Map<Key, Selector<Value, Key>>
}
