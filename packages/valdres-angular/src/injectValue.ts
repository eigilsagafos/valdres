import { signal, type Signal, DestroyRef, inject } from "@angular/core"
import { isPromiseLike, type Atom, type Selector, type Store } from "valdres"
import { injectStore } from "./injectStore"

export const injectValue = <Value extends any = any>(
    state: Atom<Value> | Selector<Value>,
    store?: Store,
): Signal<Value> => {
    const currentStore = store || injectStore()
    const destroyRef = inject(DestroyRef)
    const initial = currentStore.get(state)

    if (isPromiseLike(initial)) {
        throw new Error(
            "injectValue() received async state. Use injectAsyncValue() for selectors that return Promises.",
        )
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
