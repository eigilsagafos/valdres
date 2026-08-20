/** Cancel a resource because its store is being disposed. Implementers must be
 *  idempotent and must tolerate being called after their own terminal state was
 *  already reached — disposal cancels whatever is still registered, in no
 *  particular order.
 *
 *  This exists so store lifecycle code can own "things to cancel on dispose"
 *  without knowing what they are. Today the only implementer is
 *  `TransactionContext`; before this, `disposeStoreData` imported
 *  `cancelTransaction` directly and `storeLifecycle` named the transaction type
 *  in its resource ledger. */
export const CANCEL_ON_STORE_DISPOSE: unique symbol = Symbol.for(
    "valdres.cancelOnStoreDispose",
)

export type StoreCancellable = {
    [CANCEL_ON_STORE_DISPOSE](): void
}
