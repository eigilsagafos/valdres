import type { AtomOnMount } from "./AtomOnMount"
import type { AtomOnSet } from "./AtomOnSet"
import type { EqualFunc } from "./EqualFunc"
import type { Reactive } from "./Reactive"
import type { Schema } from "./Schema"

export type AtomOptions<Value = unknown> = {
    global?: boolean
    name?: string
    /** Schema to validate this atom's value against. A no-op unless validation
     *  is enabled — set `store({ schemaValidation: true })` or this atom's own
     *  `schemaValidation: true`. Validate-only: the value is checked but stored
     *  unchanged (transforms/coercions do not apply). See {@link Schema}. */
    schema?: Schema<Value>
    /** Per-atom override of the store's `schemaValidation` flag. When set, it
     *  wins over the store-level setting — use `true` to always validate a
     *  boundary atom (even in a store with validation off), or `false` to
     *  exempt a hot atom. Defaults to the store's setting. */
    schemaValidation?: boolean
    onSet?: AtomOnSet<Value>
    onMount?: AtomOnMount
    maxAge?: Reactive<number>
    mutable?: boolean
    staleWhileRevalidate?: Reactive<number>
    staleIfError?: Reactive<number>
    equal?: EqualFunc<Value>
}
