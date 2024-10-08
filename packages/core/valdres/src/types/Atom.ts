import type { AtomFamily } from "./AtomFamily"
import type { AtomOnInit } from "./AtomOnInit"
import type { AtomOnSet } from "./AtomOnSet"
import type { Selector } from "./Selector"

export type Atom<Value = any, FamilyKey = undefined> = {
    defaultValue?: Value | (() => Value | Promise<Value>) | Selector<Value>
    label?: string
    family?: AtomFamily<Value, FamilyKey>
    familyKey?: FamilyKey
    onInit?: AtomOnInit<Value>
    onSet?: AtomOnSet<Value>
    onMount?: () => void | (() => void)
    maxAge?: number
    staleWhileRevalidate?: number
}
