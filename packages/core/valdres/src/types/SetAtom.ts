import type { Atom } from "./Atom"
import type { SetAtomValue } from "./SetAtomValue"

export type SetAtom<V> = (atom: Atom<V>, value: SetAtomValue<V>) => void
