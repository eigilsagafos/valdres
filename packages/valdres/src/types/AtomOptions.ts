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
    /** Mount lifecycle hook — see `AtomOnMount`. Must be set before the atom is
     *  first used in a store; assigning it after the atom is already in use is
     *  unsupported. */
    onMount?: AtomOnMount<Value>
    maxAge?: Reactive<number>
    /** Opt out of development/test deep-freezing. Required when values contain
     *  mutable built-ins or host objects (for example Map, Set, Date,
     *  ArrayBuffer, DataView, typed arrays, or browser API objects) that
     *  Object.freeze cannot make safely immutable. The caller is responsible
     *  for avoiding silent in-place mutations that bypass atom notifications. */
    mutable?: boolean
    staleWhileRevalidate?: Reactive<number>
    staleIfError?: Reactive<number>
    equal?: EqualFunc<Value>
}
