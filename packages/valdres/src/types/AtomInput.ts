import type { Atom } from "./Atom"
import type { AtomFamily } from "./AtomFamily"
import type { AtomFamilyAtom } from "./AtomFamilyAtom"

/** Anything a settlement accepts as a trigger: a plain atom, a family member,
 *  or the family OBJECT itself (whose dependents observe membership, not a
 *  value). Selectors are never triggers — they are reached through the graph. */
export type AtomInput =
    | Atom<any>
    | AtomFamilyAtom<any, any>
    | AtomFamily<any, any>
