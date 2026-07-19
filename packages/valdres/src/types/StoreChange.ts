import type { Atom } from "./Atom"
import type { AtomFamilyAtom } from "./AtomFamilyAtom"
import type { Selector } from "./Selector"

/** A change to an atom, reported to a `store.onChange` listener. Discriminated on
 *  `kind` (the operation):
 *
 *  - `"set"`    — the atom now holds `value` (a direct `set`/`reset`, an async
 *                 atom resolving, a cache revalidation, …; the originating
 *                 operation is on `StoreChangeMeta.source`).
 *  - `"unset"`  — the store dropped its own value for the atom (`store.unset` /
 *                 `txn.unset`); it now reverts to what it otherwise reads. `value`
 *                 carries the inherited parent value on a scope. On a root it is
 *                 present only when a live consumer rematerialized the default
 *                 during propagation; otherwise it is omitted so reporting the
 *                 change does not evaluate a lazy default. The atom still exists
 *                 — NOT a `"delete"`. An inheritance-aware consumer switches on
 *                 the kind to drop the override; a flat mirror should also drop a
 *                 root entry when `value` is absent. `"unset"` is also on
 *                 `StoreChangeMeta.source` for a standalone unset, but inside a
 *                 transaction the source is `"transaction"`, so this per-change
 *                 kind is the only signal distinguishing it from a set.
 *  - `"delete"` — the (family) atom was removed (`store.del` / `txn.del`). There
 *                 is no value: the entry is gone from the store.
 *
 *  `state` is the changed atom. `scope` is the chain of scope ids from the
 *  outermost scope down to where the change occurred — the ids you'd pass to
 *  `.scope()` to reach it — empty (`[]`) for a root store. Unambiguous for nested
 *  scopes that share a leaf name. */
export type AtomChange =
    | {
          type: "atom"
          kind: "set"
          state: Atom<any> | AtomFamilyAtom<any, any>
          value: unknown
          scope: string[]
      }
    | {
          type: "atom"
          kind: "unset"
          state: Atom<any> | AtomFamilyAtom<any, any>
          value?: unknown
          scope: string[]
      }
    | {
          type: "atom"
          kind: "delete"
          state: Atom<any> | AtomFamilyAtom<any, any>
          scope: string[]
      }

/** A derived selector that recomputed to a new `value` as a consequence of an
 *  operation. Only reported to listeners that opted in via
 *  `onChange(cb, { selectors: true })`, and only for live selectors (a subscriber
 *  or downstream dependent) whose value actually changed (see `Store.onChange`).
 *
 *  Unlike `AtomChange`, there is **no `kind`**: a selector has no operation — it
 *  is never set/unset/deleted, it just holds a value that follows from its deps.
 *  `type: "selector"` is the whole discrimination; `value` is the recomputed
 *  value, `scope` the scope it recomputed in. */
export type SelectorChange = {
    type: "selector"
    state: Selector<any>
    value: unknown
    scope: string[]
}

/** A single change reported to a `store.onChange` listener. Discriminate first on
 *  `type` (`"atom" | "selector"`): atom changes additionally carry a `kind`
 *  (`"set" | "unset" | "delete"`); selector changes do not. */
export type StoreChange = AtomChange | SelectorChange
