import type { Store, TransactionFn } from "valdres"
import { useStore } from "./useStore"

export const useTransaction = (store?: Store) => {
    const resolvedStore = useStore(store)
    return (callback: TransactionFn) => resolvedStore.txn(callback)
}
