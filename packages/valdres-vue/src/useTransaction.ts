import type { Store, Transaction } from "valdres"
import { useStore } from "./useStore"

export const useTransaction = (store?: Store) => {
    const selectedStore = store || useStore()
    return (callback: (state: Transaction) => any) =>
        selectedStore.txn(args => callback(args))
}
