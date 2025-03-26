import type { FamilyKey } from "./FamilyKey"
import type { Selector } from "./Selector"

export type SelectorFamily<Value extends any, Args extends [any, ...any[]]> = {
    (...args: Args): Selector<Value, Args>
    __valdresSelectorFamilyMap: Map<Args, Selector<Value, Args>>
}
