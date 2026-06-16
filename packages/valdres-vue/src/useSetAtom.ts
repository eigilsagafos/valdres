import { toValue, type MaybeRefOrGetter } from "vue"
import type { Atom, SetAtomValue, Store } from "valdres"
import { useStore } from "./useStore"

/** [Docs Reference](https://valdres.dev/vue/useSetAtom)
 *
 * Write-only setter for an atom — returns a stable `(value) => void` that sets
 * the atom without subscribing to it (no re-render on change). The `atom`
 * argument may be a ref or getter; it is resolved with `toValue` at call time,
 * so a prop-driven family key is always current.
 */
export const useSetAtom = <V>(
    atom: MaybeRefOrGetter<Atom<V>>,
    store?: Store,
) => {
    const selectedStore = store || useStore()
    return (value: SetAtomValue<V>) => selectedStore.set(toValue(atom), value)
}
