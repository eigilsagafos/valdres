import type { Atom } from "./Atom"
import type { AtomFamilyAtom } from "./AtomFamilyAtom"
import type { Selector } from "./Selector"

/** One materialized state in a store's `snapshot()`. Mirrors the shape of a
 *  `store.onChange` change, minus the per-operation `kind`: a snapshot is the
 *  current state, not a transition.
 *
 *  - `type` discriminates atom vs derived selector (`isSelector`).
 *  - `state` is the atom / family-member atom / selector identity.
 *  - `value` is the current materialized value held in the store.
 *  - `scope` is the chain of scope ids from the outermost scope down to the
 *    store the value lives in — the ids you'd pass to `.scope()` to reach it —
 *    empty (`[]`) for the root store, as in `onChange`.
 *
 *  Only emitted by stores created with `{ enumerable: true }`; see
 *  `Store.snapshot`. Internal (`__valdresInternal`) states and family container
 *  objects are excluded, and selectors appear only when they hold a cached
 *  (live/evaluated) value. */
export type SnapshotEntry = {
    type: "atom" | "selector"
    state: Atom<any> | AtomFamilyAtom<any, any> | Selector<any>
    value: unknown
    scope: string[]
}
