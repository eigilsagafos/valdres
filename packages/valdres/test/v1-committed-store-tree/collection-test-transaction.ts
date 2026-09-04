import type {
    CommittedStoreTree,
    InternalCommittedStoreTreeDomain,
    RootTransaction,
    TransactionCallback,
} from "../../src/v1-internal/committed-store-tree/committed-store-tree"

/** Runs collection tests through the same public Transaction cursor used by
 * consumers. The domain parameter keeps each fixture's ownership explicit. */
export const runCollectionTransaction = <Result>(
    _domain: InternalCommittedStoreTreeDomain,
    store: CommittedStoreTree,
    callback: (transaction: RootTransaction, rows: RootTransaction) => Result,
): Result =>
    store.txn((transaction =>
        callback(transaction, transaction)) as TransactionCallback<Result>)
