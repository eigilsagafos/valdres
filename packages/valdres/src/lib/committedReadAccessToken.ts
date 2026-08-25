/** Private capability used to recover a Store's committed-only read through its
 *  closure. Batched stores answer `store.get` from the pending transaction
 *  (read-your-writes); this recovers the read that ignores staged writes, which
 *  is what a subscription-driven consumer needs — see `storeAdapter.committedGet`. */
export const COMMITTED_READ_ACCESS = Symbol("valdres.committedReadAccess")
