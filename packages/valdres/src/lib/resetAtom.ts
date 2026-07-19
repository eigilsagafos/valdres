import type { Atom } from "../types/Atom"
import type { StoreData } from "../types/StoreData"
import { commitTransaction, TransactionContext } from "./transaction"

export const resetAtom = <V>(
    atom: Atom<V>,
    data: StoreData,
): V | Promise<V> => {
    // Keep direct reset on the exact transaction write/commit path. Besides
    // preventing a second implementation from drifting, constructing the
    // transaction explicitly avoids the callback allocation of transaction().
    const txn = new TransactionContext(data)
    const value = txn.reset(atom)
    commitTransaction(txn, "reset")
    return value
}
