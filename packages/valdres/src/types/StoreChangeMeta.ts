import type { StoreChangeSource } from "./StoreChangeSource"

/** Metadata about the operation that produced a batch of store changes,
 *  passed as the second argument to a `store.onChange` callback. */
export type StoreChangeMeta = {
    /** What kind of operation produced this batch (`"set"`, `"transaction"`,
     *  `"revalidate"`, …). */
    source: StoreChangeSource
    /** The name passed to `store.txn(callback, name)`, if any. Only present for
     *  named transactions. */
    name?: string
}
