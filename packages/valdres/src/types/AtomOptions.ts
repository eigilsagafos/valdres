import type { AtomOnSet } from "./AtomOnSet"
import type { EqualFunc } from "./EqualFunc"
import type { Reactive } from "./Reactive"
import type { StoreData } from "./StoreData"

export type AtomOptions<Value = unknown> = {
    global?: boolean
    name?: string
    onInit?: (
        setSelf: (value: Value) => void,
        store: StoreData,
    ) => (() => void) | void
    onSet?: AtomOnSet<Value>
    onMount?: () => () => void
    maxAge?: Reactive<number>
    mutable?: boolean
    staleWhileRevalidate?: Reactive<number>
    staleIfError?: Reactive<number>
    equal?: EqualFunc<Value>
}
