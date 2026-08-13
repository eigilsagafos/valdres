import type { AtomDefaultValue } from "./AtomDefaultValue"
import type { AtomOnMount } from "./AtomOnMount"
import type { AtomOnSet } from "./AtomOnSet"
import type { EqualFunc } from "./EqualFunc"
import type { Reactive } from "./Reactive"
import type { Schema } from "./Schema"

export type CacheMeta = {
    isRevalidating: boolean
    lastSuccessAt: number
    maxAge: number
    staleWhileRevalidate: number
    staleIfError: number
}

export type Atom<Value = unknown> = {
    equal: EqualFunc<Value>
    defaultValue?: AtomDefaultValue<Value>
    name?: string
    schema?: Schema<Value>
    /** Per-atom override of the store's `schemaValidation` flag (see AtomOptions). */
    schemaValidation?: boolean
    onSet?: AtomOnSet<Value>
    onMount?: AtomOnMount<Value>
    maxAge?: Reactive<number>
    /** Skip development/test deep-freezing; see AtomOptions.mutable. */
    mutable?: boolean
    staleWhileRevalidate?: Reactive<number>
    staleIfError?: Reactive<number>
}
