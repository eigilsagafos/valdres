import type { AtomDefaultValue } from "./AtomDefaultValue"
import type { AtomOnInit } from "./AtomOnInit"
import type { AtomOnSet } from "./AtomOnSet"
import type { EqualFunc } from "./EqualFunc"
import type { Reactive } from "./Reactive"
import type { Selector } from "./Selector"

export type CacheMeta = {
    isRevalidating: boolean
    lastSuccessAt: number
    maxAge: number
    staleWhileRevalidate?: number
    staleIfError?: number
}

export type Atom<Value = unknown> = {
    equal: EqualFunc<Value>
    defaultValue?: AtomDefaultValue<Value>
    name?: string
    onInit?: AtomOnInit<Value>
    onSet?: AtomOnSet<Value>
    onMount?: () => void | (() => void)
    maxAge?: Reactive<number>
    mutable?: boolean
    staleWhileRevalidate?: Reactive<number>
    staleIfError?: Reactive<number>
    __cacheMeta?: Atom<CacheMeta | null>
    __cacheMetaSelector?: Selector<CacheMeta | null>
}
