import type { AtomDefaultValue } from "./AtomDefaultValue"
import type { AtomOnInit } from "./AtomOnInit"
import type { AtomOnSet } from "./AtomOnSet"

export type Atom<Value = unknown> = {
    defaultValue?: AtomDefaultValue<Value>
    label?: string
    onInit?: AtomOnInit<Value>
    onSet?: AtomOnSet<Value>
    onMount?: () => void | (() => void)
    maxAge?: number
    staleWhileRevalidate?: number
}
