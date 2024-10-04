import type { AtomFamily } from "./AtomFamily"
import type { AtomOnInit } from "./AtomOnInit"
import type { AtomOnSet } from "./AtomOnSet"

export type Atom<Value = any, FamilyKey = undefined> = {
    defaultValue?: Value | (() => Value | Promise<Value>)
    label?: string
    family?: AtomFamily<Value, FamilyKey>
    familyKey?: FamilyKey
    onInit?: AtomOnInit<Value>
    onSet?: AtomOnSet<Value>
    onMount?: () => void | (() => void)
}
