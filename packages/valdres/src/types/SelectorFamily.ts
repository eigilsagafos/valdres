import type { Schema } from "./Schema"
import type { Selector } from "./Selector"

export type SelectorFamily<Value extends any, Args extends [any, ...any[]]> = {
    (...args: Args): Selector<Value, Args>
    /** Explicitly evict a cached selector identity. Selector-family objects are
     * factories, not store-local membership state; this strong cache is not an
     * enumerable family snapshot. */
    release: (...args: Args) => boolean
    name?: string
    /** The schema members validate against, readable from the family itself —
     *  members carry the same reference via their options. */
    schema?: Schema<Value>
    /** Per-family `schemaValidation` override, mirrored from the options. */
    schemaValidation?: boolean
}
