import type { Atom } from "./Atom"
import type { SetAtomValue } from "./SetAtomValue"

export type SetAtom<V = any> = (atom: Atom<V>, value: SetAtomValue<V>) => void
