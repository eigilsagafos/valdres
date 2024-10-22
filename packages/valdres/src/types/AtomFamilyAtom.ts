import type { Atom } from "./Atom"
import type { AtomFamily } from "./AtomFamily"

export type AtomFamilyAtom<Key = unknown, Value = unknown> = Atom<Value> & {
    family: AtomFamily<Key, Value>
    familyKey: Key
}
