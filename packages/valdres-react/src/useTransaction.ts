import type { Store } from "valdres"
import type { TransactionInterface } from "./types/TransactionInterface"
import { useStore } from "./useStore"

export const useTransaction = (store?: Store) => {
    const selectedStore = store || useStore()
    return (callback: (state: TransactionInterface) => any) =>
        selectedStore.txn((set, get, reset, commit) =>
            callback({ set, get, reset, commit }),
        )
}
