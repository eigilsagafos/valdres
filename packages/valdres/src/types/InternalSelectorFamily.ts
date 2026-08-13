import type { EncodedFamilyKey } from "../lib/familyKey"
import type { WeakValueMap } from "../lib/WeakValueMap"
import type { Selector } from "./Selector"
import type { SelectorFamily } from "./SelectorFamily"

/** Engine-only selector-family fields deliberately absent from the public type. */
export type InternalSelectorFamily<
    Value extends any,
    Args extends [any, ...any[]],
> = SelectorFamily<Value, Args> & {
    /** Internal weak-value identity cache, explicitly evictable via `release`. */
    __valdresSelectorFamilyMap: WeakValueMap<
        EncodedFamilyKey,
        Selector<Value, Args>
    >
}
