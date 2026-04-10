import { signal, type Signal, DestroyRef, inject } from "@angular/core"
import { isPromiseLike, type State, type Store } from "valdres"
import { injectStore } from "./injectStore"

export const injectValue = <
    Value extends any = any,
    Args extends [any, ...any[]] = [any, ...any[]],
>(
    state: State<Value, Args>,
    store?: Store,
): Signal<Value> => {
    const currentStore = store || injectStore()
    const destroyRef = inject(DestroyRef)
    const initial = currentStore.get(state)

    if (isPromiseLike(initial)) {
        throw initial
    }

    const value = signal(initial as Value)

    // @ts-ignore
    const unsub = currentStore.sub(
        state,
        () => {
            const newValue = currentStore.get(state)
            if (!isPromiseLike(newValue)) {
                value.set(newValue as Value)
            }
        },
        false,
    )

    destroyRef.onDestroy(() => {
        unsub()
    })

    return value.asReadonly()
}
