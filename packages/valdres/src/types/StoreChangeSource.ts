/** What kind of operation produced a batch of store changes. Reported on
 *  `StoreChangeMeta.source` to a `store.onChange` listener.
 *
 *  - `"set"`         — `store.set` (including a global atom syncing to peer stores)
 *  - `"reset"`       — `store.reset` (including a global atom's `resetSelf`)
 *  - `"delete"`      — `store.del`
 *  - `"transaction"` — `store.txn` (and the implicit commit in `batchUpdates` mode)
 *  - `"revalidate"`  — a maxAge / stale-while-revalidate cache refresh
 *  - `"async-set"`   — a previously-pending async value resolved (an async `set`
 *                      settling, or an async `defaultValue` resolving) */
export type StoreChangeSource =
    | "set"
    | "reset"
    | "delete"
    | "transaction"
    | "revalidate"
    | "async-set"
