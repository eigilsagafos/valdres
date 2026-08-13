/** Options accepted by `store()`.
 *
 *  Both call forms take these: `store(options)` reads `id` from the bag, while
 *  `store(id, options)` takes the id from the first argument and rejects it in
 *  the bag (there would be two answers).
 *
 *  Every option is fixed at creation — none can be toggled on a live store. The
 *  three behavioral options (`batchUpdates`, `enumerable`, `schemaValidation`)
 *  are additionally inherited by scopes. `id` is NOT: `store.scope(scopeId)`
 *  names each scope with the id passed there, so a scope has its own `id` and
 *  the root's appears only as the head of the scope id path. */
export type StoreOptions = {
    /** Stable identity for the store, surfaced as `store.id` and as the root of
     *  the scope id path in `onChange`/`snapshot` entries. Defaults to a
     *  generated id. Only read from the options-object form — with
     *  `store(id, options)` the first argument wins. */
    id?: string
    /** Coalesce the writes of a tick into a single commit: `set`/`reset`/`del`
     *  stage their values and the store flushes them in one notification pass
     *  at the end of the microtask, instead of notifying per call. Recommended
     *  behind React, where an unbatched write per `set` costs a render each.
     *
     *  Within a batch the store and its scopes share the pending writes, so a
     *  synchronous descendant read sees a pending ancestor value while
     *  scope-local shadows stay isolated; subscriber callbacks are deferred
     *  until the batch commits. The flush reports as a `"transaction"`
     *  `StoreChangeSource`, matching the explicit `store.txn` commit it is
     *  equivalent to. Off by default; scopes inherit it from their parent. */
    batchUpdates?: boolean
    /** Retain values enumerably (a `Map`, not a `WeakMap`) so `store.snapshot()`
     *  can list the store's current state. Off by default; see `Store.snapshot`.
     *  Scopes inherit it from their parent. */
    enumerable?: boolean
    /** Validate atom/selector values against their `schema` (if any) on init,
     *  set, and selector evaluation. Off by default — opt in per store for
     *  development-time safety. Scopes inherit it from their parent. */
    schemaValidation?: boolean
}
