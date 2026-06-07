/** What kind of operation produced a batch of store changes. Reported on
 *  `StoreChangeMeta.source` to a `store.onChange` listener.
 *
 *  - `"set"`         — `store.set` (including a global atom syncing to peer stores)
 *  - `"reset"`       — `store.reset` (including a global atom's `resetSelf`)
 *  - `"delete"`      — `store.del`
 *  - `"unset"`       — `store.unset`: a store dropped its own value for an atom,
 *                      which now reverts to what it otherwise reads (a scope
 *                      re-inherits the parent; a root reverts to the default).
 *                      The reported change is a `kind: "unset"` carrying that
 *                      reverted value (NOT a `"delete"` — the atom still exists,
 *                      only the store's own value is gone). A consumer keying off
 *                      either `source === "unset"` or the per-change `kind` knows
 *                      to drop the override from a per-store view. Note `txn.unset`
 *                      reports `source === "transaction"`, so inside a txn the
 *                      per-change `kind: "unset"` is the signal that survives.
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
