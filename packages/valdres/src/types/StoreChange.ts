import type { Atom } from "./Atom"
import type { AtomFamilyAtom } from "./AtomFamilyAtom"

/** A single atom change reported to a store change listener.
 *
 *  Emitted for every committed change — a direct `set`/`reset`, an async atom
 *  resolving, a family-atom deletion (`del`), and each atom touched by a
 *  transaction. */
export type StoreChange = {
    /** The atom (or family atom) that changed. */
    atom: Atom<any> | AtomFamilyAtom<any, any>
    /** The new value after the change. For an in-flight async `set` this is the
     *  pending promise (a follow-up change reports the resolved value); for a
     *  deletion this is `undefined`. */
    value: unknown
    /** The chain of scope ids from the outermost scope down to where the change
     *  occurred — the ids you'd pass to `.scope()` to reach it. Empty (`[]`) for
     *  a change in a root store. Unambiguous for nested scopes that share a leaf
     *  name under different parents. */
    scope: string[]
    /** Present and `true` when the atom was deleted (`store.del`) rather than
     *  assigned a new value. */
    deleted?: boolean
}
