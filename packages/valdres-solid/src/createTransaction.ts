import type { Store, Transaction } from "valdres"
import { useStore } from "./useStore"

export const createTransaction = (store?: Store) => {
    const currentStore = store || useStore()
    return (callback: (txn: Transaction) => any) => currentStore.txn(callback)
}
