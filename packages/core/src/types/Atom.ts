import type { AtomFamily } from "./AtomFamily"

export type Atom<Value = unknown, FamilyKey = undefined> = {
    defaultValue?: Value | (() => Value | Promise<Value>)
    debugLabel?: string
    family?: AtomFamily<Value, FamilyKey>
    familyKey?: FamilyKey
}
