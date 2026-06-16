import { customRef, toValue, watch, type MaybeRefOrGetter, type Ref } from "vue"
import {
    isPromiseLike,
    type Atom,
    type SetAtomValue,
    type Store,
} from "valdres"
import { useStore } from "./useStore"

/** [Docs Reference](https://valdres.dev/vue/useAtom)
 *
 * Read + write reactive view of an atom. Returns a writable `Ref` whose getter
 * reads live from the store (fresh immediately after a `store.set`) and whose
 * setter writes back through the store — so it drops straight into `v-model`.
 *
 * The `atom` argument may be a ref or getter (`MaybeRefOrGetter`): a getter
 * like `() => todoFamily(props.id)` re-subscribes when the resolved family
 * member changes, so prop-driven keys stay live.
 *
 * **Async never throws.** A promise atom default reads `undefined` while pending
 * and holds the last resolved value thereafter; on a later key change it holds
 * the previous value until the new state resolves.
 */
export const useAtom = <V>(
    atom: MaybeRefOrGetter<Atom<V>>,
    store?: Store,
): Ref<V> => {
    const currentStore = store || useStore()

    let current = toValue(atom)
    const initial = currentStore.get(current)
    let last: V | undefined = isPromiseLike(initial)
        ? undefined
        : (initial as V)

    let triggerRef: (() => void) | undefined
    let unsub: (() => void) | undefined
    let initialized = false

    const ref = customRef<V>((track, trigger) => {
        triggerRef = trigger
        return {
            get() {
                track()
                const v = currentStore.get(current)
                if (!isPromiseLike(v)) last = v as V
                return last as V
            },
            set(value: V) {
                currentStore.set(current, value as SetAtomValue<V>)
            },
        }
    })

    watch(
        () => toValue(atom),
        (next, _prev, onCleanup) => {
            current = next
            unsub?.()
            const v = currentStore.get(next)
            if (!isPromiseLike(v)) {
                last = v as V
            } else if (!initialized) {
                last = undefined
            }
            initialized = true
            unsub = currentStore.sub(next, () => triggerRef?.(), false)
            onCleanup(() => {
                unsub?.()
                unsub = undefined
            })
            triggerRef?.()
        },
        { immediate: true },
    )

    return ref
}
