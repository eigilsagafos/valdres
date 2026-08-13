import type { EncodedFamilyKey } from "../lib/familyKey"
import type { Selector } from "./Selector"
import type { SelectorFamily } from "./SelectorFamily"

/** Engine-only selector-family fields deliberately absent from the public type. */
export type InternalSelectorFamily<
    Value extends any,
    Args extends [any, ...any[]],
> = SelectorFamily<Value, Args> & {
    /** Internal strong identity cache, evicted through `release`. */
    __valdresSelectorFamilyMap: Map<EncodedFamilyKey, Selector<Value, Args>>
}
