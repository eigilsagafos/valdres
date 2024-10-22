import type { Atom } from "./Atom"
import type { SetAtomValue } from "./SetAtomValue"

export type SetAtom<Value = any> = (
    atom: Atom<Value>,
    value: SetAtomValue<Value>,
    scopeId?: string,
) => void
