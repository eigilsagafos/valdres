import { shallowRef, onScopeDispose, type Readonly, type Ref } from "vue"
import { isPromiseLike, type Atom, type Selector, type Store } from "valdres"
import { useStore } from "./useStore"

export const useValue = <Value extends any = any>(
    state: Atom<Value> | Selector<Value>,
    store?: Store,
): Readonly<Ref<Value>> => {
    const currentStore = store || useStore()
    const initial = currentStore.get(state)

    if (isPromiseLike(initial)) {
        throw initial
    }

    const value = shallowRef(initial)

    // @ts-ignore
    const unsub = currentStore.sub(
        state,
        () => {
            const newValue = currentStore.get(state)
            if (!isPromiseLike(newValue)) {
                value.value = newValue
            }
        },
        false,
    )

    onScopeDispose(() => {
        unsub()
    })

    return value as Readonly<Ref<Value>>
}
