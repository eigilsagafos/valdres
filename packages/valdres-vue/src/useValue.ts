import {
    customRef,
    toValue,
    watch,
    type MaybeRefOrGetter,
    type ShallowRef,
} from "vue"
import { isPromiseLike, type Atom, type Selector, type Store } from "valdres"
import { useStore } from "./useStore"

/** [Docs Reference](https://valdres.dev/vue/useValue)
 *
 * Read-only reactive view of an atom or selector. Returns a read-through
 * `customRef`: reading `.value` reads live from the store, so it is fresh
 * immediately after a `store.set` (consistent with {@link useAtom}, even under
 * the default batched store). Subscribers still re-trigger tracking effects on
 * commit. A chained `computed()` stays microtask-deferred — this is sibling
 * consistency with `useAtom`, not full synchronous propagation.
 *
 * The `state` argument may be a ref or getter (`MaybeRefOrGetter`): a getter
 * like `() => todoFamily(props.id)` re-subscribes when the resolved family
 * member changes, so prop-driven keys stay live.
 *
 * **Async selectors never throw.** On a pending async selector (or a promise
 * atom default) the ref reads `undefined` while pending and holds the last
 * resolved value thereafter; on a later key change it holds the previous value
 * until the new state resolves. For pending/error status or `<Suspense>`
 * support, use {@link useAsyncValue}.
 */
export const useValue = <Value>(
    state: MaybeRefOrGetter<Atom<Value> | Selector<Value>>,
    store?: Store,
): Readonly<ShallowRef<Value>> => {
    const currentStore = store || useStore()

    let current = toValue(state)
    const initial = currentStore.get(current)
    // `last` holds the most recent non-promise value (undefined while a pending
    // async selector/atom-default has never resolved).
    let last: Value | undefined = isPromiseLike(initial)
        ? undefined
        : (initial as Value)

    let triggerRef: (() => void) | undefined
    let unsub: (() => void) | undefined
    let initialized = false

    const value = customRef<Value>((track, trigger) => {
        triggerRef = trigger
        return {
            get() {
                track()
                const v = currentStore.get(current)
                if (!isPromiseLike(v)) last = v as Value
                return last as Value
            },
            set() {},
        }
    })

    watch(
        () => toValue(state),
        (next, _prev, onCleanup) => {
            current = next
            unsub?.()
            const v = currentStore.get(next)
            if (!isPromiseLike(v)) {
                last = v as Value
            } else if (!initialized) {
                // First (immediate) run: surface undefined while pending.
                last = undefined
            }
            // Later key change with a pending value: hold the previous `last`.
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

    return value as Readonly<ShallowRef<Value>>
}
