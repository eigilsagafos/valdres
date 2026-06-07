import type { Atom } from "./Atom"
import type { AtomFamilyAtom } from "./AtomFamilyAtom"

/** A single atom change reported to a store change listener — a discriminated
 *  union on `kind`.
 *
 *  - `"set"`    — the atom now holds `value` (a direct `set`/`reset`, an async
 *                 atom resolving, a cache revalidation, …; the originating
 *                 operation is on `StoreChangeMeta.source`).
 *  - `"unset"`  — the store dropped its own value for the atom (`store.unset` /
 *                 `txn.unset`); the atom now reverts to what it otherwise reads,
 *                 carried as `value` (the inherited parent value on a scope, the
 *                 default on a root). The atom still exists — this is NOT a
 *                 `"delete"`. A flat value-mirror can read `value`; an
 *                 inheritance-aware consumer switches on the kind to drop the
 *                 override. `"unset"` is also on `StoreChangeMeta.source` for a
 *                 standalone unset, but inside a transaction the source is
 *                 `"transaction"`, so this per-change kind is the only signal
 *                 distinguishing it from a set.
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
          kind: "unset"
          atom: Atom<any> | AtomFamilyAtom<any, any>
          value: unknown
          scope: string[]
      }
    | {
          kind: "delete"
          atom: Atom<any> | AtomFamilyAtom<any, any>
          scope: string[]
      }
