import type { Atom } from "./Atom"
import type { AtomFamily } from "./AtomFamily"

export type AtomFamilyAtom<Value = unknown, Key = unknown> = Atom<Value> & {
    family?: AtomFamily<Value, Key>
    familyKey?: Key
}
