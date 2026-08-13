import type { EncodedFamilyKey } from "../lib/familyKey"
import type { WeakValueMap } from "../lib/WeakValueMap"
import type { AtomFamily } from "./AtomFamily"
import type { AtomFamilyAtom } from "./AtomFamilyAtom"

/** Engine-only atom-family fields deliberately absent from the public type. */
export type InternalAtomFamily<
    Value extends any,
    Args extends [any, ...any[]] = [any, ...any[]],
> = AtomFamily<Value, Args> & {
    __valdresOnMount?: never
    /** Family containers are filtered separately and never use the internal
     *  atom/selector reporting marker. Declared for the InternalState union. */
    __valdresInternal?: never
    /** Shared weak-value identity cache, typed as its actual runtime shape. */
    __valdresAtomFamilyMap: WeakValueMap<
        EncodedFamilyKey,
        AtomFamilyAtom<Value, Args>
    >
}
