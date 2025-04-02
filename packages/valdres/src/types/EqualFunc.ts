import type { Atom } from "./Atom"
import type { AtomFamilyAtom } from "./AtomFamilyAtom"

export type EqualFunc<Value extends any> = (
    a: Value,
    b: Value,
    updatedAtomSet?: Set<Atom | AtomFamilyAtom<any>>,
) => boolean
