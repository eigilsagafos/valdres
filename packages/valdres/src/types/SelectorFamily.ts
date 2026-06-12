import type { FamilyKey } from "../lib/familyKey"
import type { Schema } from "./Schema"
import type { Selector } from "./Selector"

export type SelectorFamily<Value extends any, Args extends [any, ...any[]]> = {
    (...args: Args): Selector<Value, Args>
    release: (...args: Args) => boolean
    name?: string
    /** The schema members validate against, readable from the family itself —
     *  members carry the same reference via their options. */
    schema?: Schema<Value>
    /** Per-family `schemaValidation` override, mirrored from the options. */
    schemaValidation?: boolean
    __valdresSelectorFamilyMap: Map<FamilyKey, Selector<Value, Args>>
}
