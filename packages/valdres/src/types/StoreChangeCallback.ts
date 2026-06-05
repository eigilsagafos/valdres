import type { StoreChange } from "./StoreChange"
import type { StoreChangeMeta } from "./StoreChangeMeta"

/** Callback registered via `store.onChange`. Invoked once per committed
 *  operation with every atom that changed: a single `set`/`reset` delivers a
 *  one-element array, a transaction delivers one array with all its changes.
 *  `meta` carries operation metadata such as a transaction's `name`. */
export type StoreChangeCallback = (
    changes: StoreChange[],
    meta: StoreChangeMeta,
) => void
