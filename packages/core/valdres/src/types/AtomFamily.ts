import type { Atom } from "./Atom"

export type AtomFamily<Value, Key> = {
    (key: Key, defaultOverride?: any): Atom<Value>
    _map: Map<Key, Atom<Value, Key>>
}
