import type { StoreChangeSource } from "./StoreChangeSource"

/** Metadata about the operation that produced a batch of store changes,
 *  passed as the second argument to a `store.onChange` callback. */
export type StoreChangeMeta = {
    /** What kind of operation produced this batch (`"set"`, `"transaction"`,
     *  `"revalidate"`, …). */
    source: StoreChangeSource
    /** The human-facing label passed to `store.txn(callback, name)`, if any.
     *  Only present for named transactions; meant for dev-tools timelines, not
     *  for programmatic dispatch — use `origin` for that. */
    name?: string
    /** Machine-readable provenance tag for the transaction, set via
     *  `store.txn(callback, { origin })`. Middleware (state-sync layers,
     *  persistence, undo) tags the transactions it applies so its own
     *  `onChange` listener can recognize them — e.g. echo suppression: ignore
     *  changes carrying its own `origin`. Unlike `name`, it never appears in
     *  dev-tools labels. Absent for non-transaction paths (plain set/reset) and
     *  for transactions that don't set it. */
    origin?: string
}
