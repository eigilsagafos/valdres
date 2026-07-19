import type { StoreData } from "../types/StoreData"
import type { StoreChangeSource } from "../types/StoreChangeSource"
import {
    abortTransaction,
    commitTransaction,
    TransactionContext,
} from "./transaction"

/** Manually controlled transaction for framework compatibility adapters.
 * Application code should use `store.txn`, which owns commit/rollback. */
export class Transaction extends TransactionContext {
    constructor(data: StoreData) {
        super(data)
    }

    commit(source?: StoreChangeSource): void {
        commitTransaction(this, source)
    }

    abort(): void {
        abortTransaction(this)
    }
}
