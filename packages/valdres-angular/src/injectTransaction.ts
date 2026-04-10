import type { Store, Transaction } from "valdres"
import { injectStore } from "./injectStore"

export const injectTransaction = (store?: Store) => {
    const selectedStore = store || injectStore()
    return (callback: (state: Transaction) => any) =>
        selectedStore.txn(callback)
}
