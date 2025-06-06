import type { AtomOnSet } from "./AtomOnSet"
import type { EqualFunc } from "./EqualFunc"
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
    maxAge?: number
    mutable?: boolean
    staleWhileRevalidate?: number
    equal?: EqualFunc<Value>
}
