import {
    computed,
    ref,
    shallowRef,
    toValue,
    watch,
    type MaybeRefOrGetter,
    type Ref,
    type ShallowRef,
} from "vue"
import { isPromiseLike, type Selector, type Store } from "valdres"
import { useStore } from "./useStore"

/** The reactive box returned by {@link useAsyncValue} — the Pinia Colada /
 *  TanStack vue-query v5 shape. */
export interface AsyncValue<T> {
    /** The resolved value, or `undefined` while pending (holds the previous
     *  value across a refetch). */
    data: Readonly<ShallowRef<T | undefined>>
    /** The rejection reason when `status` is `"error"`, else `undefined`. */
    error: Readonly<ShallowRef<unknown>>
    /** `true` while the (current) async evaluation is in flight. */
    isPending: Readonly<Ref<boolean>>
    /** `"pending" | "success" | "error"`. */
    status: Readonly<Ref<"pending" | "success" | "error">>
    /** Resolve the final value — for `await useAsyncValue(sel).suspense()` in an
     *  async `setup()` under `<Suspense>`. Loops await→re-get so it resolves
     *  through chained dependency promises. */
    suspense: () => Promise<T>
}

/** [Docs Reference](https://valdres.dev/vue/useAsyncValue)
 *
 * Consume a (possibly async) selector as a reactive `{ data, error, isPending,
 * status, suspense }` box — the Vue-native way to read async state without
 * throwing. While the selector is pending, `data` is `undefined`, `isPending`
 * is `true`, and `status` is `"pending"`; on resolve `data` holds the value and
 * `status` is `"success"`; on rejection `error` holds the reason and `status`
 * is `"error"`. A dependency/key change re-enters the pending state (holding the
 * previous `data` until the new value resolves).
 *
 * The `state` argument may be a ref or getter (`MaybeRefOrGetter`) so a
 * prop-driven selector key stays live. For `<Suspense>`, await `suspense()` in
 * an async `setup()`:
 *
 * ```vue
 * <script setup lang="ts">
 * const user = await useAsyncValue(userSelector).suspense()
 * </script>
 * ```
 *
 * `suspense()` loops await→re-get because core returns the *dependency's*
 * promise when a selector is suspended, not a promise of the final value — so a
 * chain of async dependencies resolves fully before it returns.
 */
export const useAsyncValue = <T>(
    state: MaybeRefOrGetter<Selector<T>>,
    store?: Store,
): AsyncValue<T> => {
    const currentStore = store || useStore()

    const data = shallowRef<T | undefined>(undefined)
    const error = shallowRef<unknown>(undefined)
    const status = ref<"pending" | "success" | "error">("pending")
    const isPending = computed(() => status.value === "pending")

    let current = toValue(state)
    // The promise currently awaited — also the guard that drops settlement
    // callbacks from a superseded evaluation. Read the selector value only in
    // `refresh` (on subscribe + genuine dependency/key change), never in a
    // getter: core re-evaluates an async selector on every `get`, so per-access
    // reads would issue a fresh promise and oscillate the status.
    let tracked: Promise<T> | undefined

    const refresh = () => {
        const next: unknown = currentStore.get(current)
        if (isPromiseLike<T>(next)) {
            if (next === tracked) return
            tracked = next
            status.value = "pending"
            error.value = undefined
            next.then(
                resolved => {
                    if (tracked !== next) return
                    data.value = resolved
                    status.value = "success"
                    error.value = undefined
                },
                reason => {
                    if (tracked !== next) return
                    error.value = reason
                    status.value = "error"
                },
            )
        } else {
            tracked = undefined
            data.value = next as T
            status.value = "success"
            error.value = undefined
        }
    }

    const suspense = async (): Promise<T> => {
        try {
            let v: unknown = currentStore.get(current)
            while (isPromiseLike<T>(v)) {
                await v
                v = currentStore.get(current)
            }
            data.value = v as T
            status.value = "success"
            error.value = undefined
            return v as T
        } catch (reason) {
            error.value = reason
            status.value = "error"
            throw reason
        }
    }

    watch(
        () => toValue(state),
        (next, _prev, onCleanup) => {
            current = next
            tracked = undefined
            refresh()
            const unsub = currentStore.sub(next, () => refresh(), false)
            onCleanup(() => unsub())
        },
        { immediate: true },
    )

    return { data, error, isPending, status, suspense }
}
