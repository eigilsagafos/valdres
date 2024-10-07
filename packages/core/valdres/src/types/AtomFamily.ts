import type { Atom } from "./Atom"

export type AtomFamily<Value = any, Key = any> = {
    (key: Key, defaultOverride?: any): Atom<Value>
    label?: string
    __valdresAtomFamilyMap: Map<Key, Atom<Value, Key>>
}
