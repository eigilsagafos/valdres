import type { State, Store } from "valdres"
import { getStore } from "./getStore"

export const getValue = <Value = any>(
    state: State<Value>,
    store?: Store,
): { readonly value: Value } => {
    const resolvedStore = getStore(store)
    let value = $state(resolvedStore.get(state))

    $effect.pre(() => {
        value = resolvedStore.get(state)
        const unsub = resolvedStore.sub(state, () => {
            value = resolvedStore.get(state)
        })
        return unsub
    })

    return {
        get value() {
            return value
        },
    }
}
