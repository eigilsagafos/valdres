import { toValue, type MaybeRefOrGetter } from "vue"
import type { Atom, Store } from "valdres"
import { useStore } from "./useStore"

/** [Docs Reference](https://valdres.dev/vue/useResetAtom)
 *
 * Returns a stable `() => void` that resets an atom to its default value without
 * subscribing to it. The `atom` argument may be a ref or getter; it is resolved
 * with `toValue` at call time, so a prop-driven family key is always current.
 */
export const useResetAtom = <V>(
    atom: MaybeRefOrGetter<Atom<V>>,
    store?: Store,
): (() => void) => {
    const selectedStore = store || useStore()
    return () => selectedStore.reset(toValue(atom))
}
