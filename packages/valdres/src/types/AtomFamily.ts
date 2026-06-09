import type { FamilyKey } from "../lib/familyKey"
import type { AtomFamilyAtom } from "./AtomFamilyAtom"
import type { EqualFunc } from "./EqualFunc"
import type { Schema } from "./Schema"

export type AtomFamily<
    Value extends any,
    Args extends [any, ...any[]] = [any, ...any[]],
> = {
    (...args: Args): AtomFamilyAtom<Value, Args>
    release: (...args: Args) => void
    equal: EqualFunc<Value>
    name?: string
    mutable?: boolean
    /** The schema members validate against, readable from the family itself —
     *  members carry the same reference via their options. */
    schema?: Schema<Value>
    /** Per-family `schemaValidation` override, mirrored from the options. */
    schemaValidation?: boolean
    /** AtomFamily itself is not mountable; these are declared `never` to keep
     *  the State union's dynamic mount-check uniform without runtime casts. */
    onMount?: never
    __valdresOnMount?: never
    __valdresAtomFamilyMap: Map<FamilyKey, AtomFamilyAtom<Value, Args>>
}
