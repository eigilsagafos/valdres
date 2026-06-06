/** What kind of operation produced a batch of store changes. Reported on
 *  `StoreChangeMeta.source` to a `store.onChange` listener.
 *
 *  - `"set"`         — `store.set` (including a global atom syncing to peer stores)
 *  - `"reset"`       — `store.reset` (including a global atom's `resetSelf`)
 *  - `"delete"`      — `store.del`
 *  - `"unset"`       — `scopedStore.unset`: a scope dropped its own value for an
 *                      atom and now re-inherits the parent's. The reported change
 *                      is a `"set"` carrying the now-inherited value (NOT a
 *                      `"delete"` — the atom still exists, only the scope override
 *                      is gone). A consumer keying off `source === "unset"` knows
 *                      to drop the override from a per-scope view.
 *  - `"transaction"` — `store.txn` (and the implicit commit in `batchUpdates` mode)
 *  - `"revalidate"`  — a maxAge / stale-while-revalidate cache refresh
 *  - `"async-set"`   — a previously-pending async value resolved (an async `set`
 *                      settling, or an async `defaultValue` resolving) */
export type StoreChangeSource =
    | "set"
    | "reset"
    | "delete"
    | "unset"
    | "transaction"
    | "revalidate"
    | "async-set"
