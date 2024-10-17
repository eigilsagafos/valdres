import type { AtomFamilyAtom } from "./AtomFamilyAtom"
import type { FamilyKey } from "./FamilyKey"

export type AtomFamily<Key = FamilyKey, Value = unknown> = {
    (key: Key): AtomFamilyAtom<Value, Key>
    release: (key: Key) => void
    label?: string
    __valdresAtomFamilyMap: Map<Key, AtomFamilyAtom<Value, Key>>
}
