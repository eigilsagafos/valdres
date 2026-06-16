import type { Store, TransactionFn } from "valdres"
import { useStore } from "./useStore"

/** [Docs Reference](https://valdres.dev/vue/useTransaction)
 *
 * Returns a runner that commits a batch of writes in a single transaction —
 * subscribers and selectors observe one atomic commit. An optional `name` is
 * forwarded to core for devtools (`store.onChange` `meta`).
 *
 * ```ts
 * const txn = useTransaction()
 * txn(({ set, reset }) => { set(countAtom, 0); reset(todoFamily(id)) }, "reset-board")
 * ```
 */
export const useTransaction = (store?: Store) => {
    const selectedStore = store || useStore()
    return (callback: TransactionFn, name?: string) =>
        selectedStore.txn(callback, name)
}
