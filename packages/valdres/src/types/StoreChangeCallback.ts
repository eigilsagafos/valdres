import type { StoreChange } from "./StoreChange"
import type { StoreChangeMeta } from "./StoreChangeMeta"

/** The broad callback shape for `store.onChange` — receives the full
 *  `StoreChange` union (atoms, and for opted-in listeners selectors). The precise
 *  per-option callback types (atoms-only by default, selectors-only, or both) are
 *  expressed by the overloads on `Store["onChange"]`; this is the internal
 *  storage / implementation shape.
 *
 *  Fires once per committed operation with all of that operation's changes (a
 *  transaction batches them; a single `set`/`reset` typically delivers one atom
 *  change, but a `{ selectors: true }` listener may also receive the selectors
 *  that recomputed as a result). `meta` carries operation metadata such as a
 *  transaction's `name`. `changes` is `readonly` — listeners sharing the same
 *  opt-in are handed one array instance per operation, so it must not be
 *  mutated. */
export type StoreChangeCallback = (
    changes: readonly StoreChange[],
    meta: StoreChangeMeta,
) => void
