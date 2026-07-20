import type { FamilyKey } from "./FamilyKey"

export type IndexOptions<Term = unknown> = {
    name?: string
    /** Derive deterministic selector-cache identity from a term the built-in
     * family-key codec does not support, or intentionally group terms. */
    keyOf?: (term: Term) => FamilyKey
}
