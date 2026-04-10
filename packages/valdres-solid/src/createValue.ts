import { from, type Accessor } from "solid-js"
import { isPromiseLike, type State, type Store } from "valdres"
import { useStore } from "./useStore"

export const createValue = <
    Value extends any = any,
    Args extends [any, ...any[]] = [any, ...any[]],
>(
    state: State<Value, Args>,
    store?: Store,
): Accessor<Value> => {
    const currentStore = store || useStore()
    const initial = currentStore.get(state)

    if (isPromiseLike(initial)) {
        throw initial
    }

    return from<Value>(set => {
        set(() => initial as Value)
        // @ts-ignore
        return currentStore.sub(
            state,
            () => {
                const next = currentStore.get(state)
                if (!isPromiseLike(next)) {
                    set(() => next as Value)
                }
            },
            false,
        )
    })
}
