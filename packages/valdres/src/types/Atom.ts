import type { AtomDefaultValue } from "./AtomDefaultValue"
import type { AtomOnInit } from "./AtomOnInit"
import type { AtomOnSet } from "./AtomOnSet"
import type { EqualFunc } from "./EqualFunc"

export type Atom<Value = unknown> = {
    equal: EqualFunc<Value>
    defaultValue?: AtomDefaultValue<Value>
    name?: string
    onInit?: AtomOnInit<Value>
    onSet?: AtomOnSet<Value>
    onMount?: () => void | (() => void)
    maxAge?: number
    mutable?: boolean
    staleWhileRevalidate?: number
}
