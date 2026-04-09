import type { Store, TransactionFn } from "valdres"
import { getStore } from "./getStore"

export const getTransaction = (store?: Store) => {
    const resolvedStore = getStore(store)
    return (callback: TransactionFn) => resolvedStore.txn(callback)
}
