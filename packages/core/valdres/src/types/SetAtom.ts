import type { Atom } from "./Atom"
import type { SetAtomValue } from "./SetAtomValue"

export type SetAtom<V = unknown> = (
    atom: Atom<V>,
    value: SetAtomValue<V>,
) => void
