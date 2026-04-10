import {
    signal,
    computed,
    type Signal,
    DestroyRef,
    inject,
} from "@angular/core"
import { isPromiseLike, type Atom, type Selector, type Store } from "valdres"
import { injectStore } from "./injectStore"

export type AsyncValueStatus = "loading" | "resolved" | "error"

export interface AsyncValue<V> {
    readonly value: Signal<V | undefined>
    readonly status: Signal<AsyncValueStatus>
    readonly error: Signal<unknown | undefined>
    readonly isLoading: Signal<boolean>
    readonly hasValue: Signal<boolean>
}

export const injectAsyncValue = <V>(
    state: Atom<V> | Selector<V>,
    store?: Store,
): AsyncValue<V> => {
    const currentStore = store || injectStore()
    const destroyRef = inject(DestroyRef)

    const value = signal<V | undefined>(undefined)
    const status = signal<AsyncValueStatus>("loading")
    const error = signal<unknown | undefined>(undefined)
    let destroyed = false

    const handleValue = (val: unknown) => {
        if (isPromiseLike(val)) {
            status.set("loading")
            ;(val as Promise<V>).then(
                (resolved: V) => {
                    if (destroyed) return
                    value.set(resolved)
                    status.set("resolved")
                    error.set(undefined)
                },
                (err: unknown) => {
                    if (destroyed) return
                    error.set(err)
                    status.set("error")
                },
            )
        } else {
            value.set(val as V)
            status.set("resolved")
            error.set(undefined)
        }
    }

    handleValue(currentStore.get(state))

    // @ts-ignore
    const unsub = currentStore.sub(
        state,
        () => {
            handleValue(currentStore.get(state))
        },
        false,
    )

    destroyRef.onDestroy(() => {
        destroyed = true
        unsub()
    })

    return {
        value: value.asReadonly(),
        status: status.asReadonly(),
        error: error.asReadonly(),
        isLoading: computed(() => status() === "loading"),
        hasValue: computed(() => value() !== undefined),
    }
}
