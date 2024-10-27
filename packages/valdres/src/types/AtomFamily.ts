import type { Atom } from "./Atom"
import type { AtomFamilyAtom } from "./AtomFamilyAtom"
import type { FamilyKey } from "./FamilyKey"
import type { Selector } from "./Selector"

export type AtomFamily<Key = FamilyKey, Value = unknown> = {
    (key: Key): AtomFamilyAtom<Key, Value>
    release: (key: Key) => void
    label?: string
    __valdresAtomFamilyMap: Map<Key, AtomFamilyAtom<Key, Value>>
    __keysAtom: Atom<Set<Key>>
    __keysSelector: Selector<Key[]>
}
