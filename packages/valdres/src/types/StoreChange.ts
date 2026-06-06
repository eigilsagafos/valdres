import type { Atom } from "./Atom"
import type { AtomFamilyAtom } from "./AtomFamilyAtom"

/** A single atom change reported to a store change listener — a discriminated
 *  union on `kind`.
 *
 *  - `"set"`    — the atom now holds `value` (a direct `set`/`reset`, an async
 *                 atom resolving, a cache revalidation, …; the originating
 *                 operation is on `StoreChangeMeta.source`).
 *  - `"delete"` — the (family) atom was removed (`store.del` / `txn.del`). There
 *                 is no value: the entry is gone from the store.
 *
 *  `scope` is the chain of scope ids from the outermost scope down to where the
 *  change occurred — the ids you'd pass to `.scope()` to reach it — empty (`[]`)
 *  for a root store. Unambiguous for nested scopes that share a leaf name. */
export type StoreChange =
    | {
          kind: "set"
          atom: Atom<any> | AtomFamilyAtom<any, any>
          value: unknown
          scope: string[]
      }
    | {
          kind: "delete"
          atom: Atom<any> | AtomFamilyAtom<any, any>
          scope: string[]
      }
