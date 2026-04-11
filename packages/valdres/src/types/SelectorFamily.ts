import type { FamilyKey } from "../lib/familyKey"
import type { Selector } from "./Selector"

export type SelectorFamily<Value extends any, Args extends [any, ...any[]]> = {
    (...args: Args): Selector<Value, Args>
    release: (...args: Args) => boolean
    __valdresSelectorFamilyMap: Map<FamilyKey, Selector<Value, Args>>
}
