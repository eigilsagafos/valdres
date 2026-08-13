import type { Schema } from "./Schema"
import type { Selector } from "./Selector"

export type SelectorFamily<Value extends any, Args extends [any, ...any[]]> = {
    (...args: Args): Selector<Value, Args>
    /** Explicitly evict a cached selector identity. Identity is otherwise stable
     * while a caller or live store strongly retains the member; a cold read in a
     * default non-enumerable store alone does not. After collection, a later call
     * may create a fresh member. Selector families are factories, not enumerable
     * store-local membership state. */
    release: (...args: Args) => boolean
    name?: string
    /** The schema members validate against, readable from the family itself —
     *  members carry the same reference via their options. */
    schema?: Schema<Value>
    /** Per-family `schemaValidation` override, mirrored from the options. */
    schemaValidation?: boolean
}
