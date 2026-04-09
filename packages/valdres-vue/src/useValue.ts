import { shallowRef, onScopeDispose, readonly, type DeepReadonly, type Ref } from "vue"
import { isPromiseLike, type State, type Store } from "valdres"
import { useStore } from "./useStore"

export const useValue = <
    Value extends any = any,
    Args extends [any, ...any[]] = [any, ...any[]],
>(
    state: State<Value, Args>,
    store?: Store,
): DeepReadonly<Ref<Value>> => {
    const currentStore = store || useStore()
    const value = shallowRef(currentStore.get(state))

    if (isPromiseLike(value.value)) {
        throw value.value
    }

    // @ts-ignore
    const unsub = currentStore.sub(
        state,
        () => {
            const newValue = currentStore.get(state)
            if (isPromiseLike(newValue)) {
                throw newValue
            }
            value.value = newValue
        },
        false,
    )

    onScopeDispose(() => {
        unsub()
    })

    return readonly(value) as DeepReadonly<Ref<Value>>
}
