import type { FamilyKey } from "../lib/familyKey"
import type { AtomFamilyAtom } from "./AtomFamilyAtom"
import type { EqualFunc } from "./EqualFunc"
import type { Schema } from "./Schema"

export type AtomFamily<
    Value extends any,
    Args extends [any, ...any[]] = [any, ...any[]],
> = {
    (...args: Args): AtomFamilyAtom<Value, Args>
    /**
     * @deprecated Atom-family members leave the weak identity cache
     * automatically once nothing retains them. This compatibility method is a
     * no-op because manually evicting a live member would break shared identity
     * across stores.
     */
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
    /** Shared weak-value identity cache. Its Map-shaped iteration surface only
     *  exposes members that are still strongly reachable by a caller/store. */
    __valdresAtomFamilyMap: Map<FamilyKey, AtomFamilyAtom<Value, Args>>
}
