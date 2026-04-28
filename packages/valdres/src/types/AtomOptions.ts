import type { AtomOnMount } from "./AtomOnMount"
import type { AtomOnSet } from "./AtomOnSet"
import type { EqualFunc } from "./EqualFunc"
import type { Reactive } from "./Reactive"
import type { Schema } from "./Schema"

export type AtomOptions<Value = unknown> = {
    global?: boolean
    name?: string
    schema?: Schema<Value>
    onSet?: AtomOnSet<Value>
    onMount?: AtomOnMount
    maxAge?: Reactive<number>
    mutable?: boolean
    staleWhileRevalidate?: Reactive<number>
    staleIfError?: Reactive<number>
    equal?: EqualFunc<Value>
}
