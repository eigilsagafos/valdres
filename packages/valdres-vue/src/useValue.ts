import { shallowRef, onScopeDispose, type Readonly, type Ref } from "vue"
import { isPromiseLike, type State, type Store } from "valdres"
import { useStore } from "./useStore"

export const useValue = <
    Value extends any = any,
    Args extends [any, ...any[]] = [any, ...any[]],
>(
    state: State<Value, Args>,
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
