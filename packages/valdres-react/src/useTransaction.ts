import type { Store, TransactionInterface } from "valdres"
import { useStore } from "./useStore"

export const useTransaction = (store?: Store) => {
    const selectedStore = store || useStore()
    return (callback: (state: TransactionInterface) => any) =>
        selectedStore.txn(args => callback(args))
}
