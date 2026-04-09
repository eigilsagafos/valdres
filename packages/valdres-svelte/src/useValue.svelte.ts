import type { State, Store } from "valdres"
import { useStore } from "./useStore"

export const useValue = <Value = any>(
    state: State<Value>,
    store?: Store,
): { readonly current: Value } => {
    const resolvedStore = useStore(store)
    let current = $state(resolvedStore.get(state))

    $effect(() => {
        current = resolvedStore.get(state)
        const unsub = resolvedStore.sub(state, () => {
            current = resolvedStore.get(state)
        })
        return unsub
    })

    return {
        get current() {
            return current
        },
    }
}
