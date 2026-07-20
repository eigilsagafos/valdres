import type { Store } from "../types/Store"
import type { StoreChangeSource } from "../types/StoreChangeSource"
import { getStoreData } from "./getStoreData"
import {
    abortTransaction,
    commitTransaction,
    TransactionContext,
} from "./transaction"

/** Manually controlled transaction for framework compatibility adapters.
 * Application code should use `store.txn`, which owns commit/rollback. */
export class Transaction extends TransactionContext {
    constructor(store: Store) {
        super(getStoreData(store))
    }

    commit(source?: StoreChangeSource): void {
        commitTransaction(this, source)
    }

    abort(): void {
        abortTransaction(this)
    }
}
