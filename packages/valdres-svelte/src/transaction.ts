import type { Store, TransactionFn } from "valdres"
import { getValdresContext } from "./getValdresContext"

/** Create a transaction runner bound to the current context store.
 *
 *  Call it during component initialization so it captures the store then —
 *  Svelte throws `lifecycle_outside_component` for `getContext` inside an event
 *  handler, so the returned function is what makes a transaction safe to run
 *  later from a handler. Forwards core's optional devtools `name`.
 *
 * ```svelte
 * <script lang="ts">
 *     import { transaction } from "valdres-svelte"
 *     const txn = transaction()
 *     const buyTwo = () => txn(({ set, get }) => set(countAtom, get(countAtom) + 2))
 * </script>
 * ```
 */
export function transaction(
    store?: Store,
): (callback: TransactionFn, name?: string) => void {
    const currentStore = store ?? getValdresContext()
    return (callback: TransactionFn, name?: string) =>
        currentStore.txn(callback, name)
}
