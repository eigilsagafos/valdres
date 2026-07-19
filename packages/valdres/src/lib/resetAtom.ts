import type { Atom } from "../types/Atom"
import type { StoreData } from "../types/StoreData"
import {
    abortTransaction,
    commitTransaction,
    TransactionContext,
} from "./transaction"

export const resetAtom = <V>(
    atom: Atom<V>,
    data: StoreData,
): V | Promise<V> => {
    // Keep direct reset on the exact transaction write/commit path. Besides
    // preventing a second implementation from drifting, constructing the
    // transaction explicitly avoids the callback allocation of transaction().
    const txn = new TransactionContext(data)
    try {
        const value = txn.reset(atom)
        commitTransaction(txn, "reset")
        return value
    } catch (error) {
        // Staging failures leave the context open; commit failures already
        // close it in their own finally. Either way, preserve the original
        // reset error while ensuring the lifecycle ledger is released.
        try {
            abortTransaction(txn)
        } catch {}
        throw error
    }
}
