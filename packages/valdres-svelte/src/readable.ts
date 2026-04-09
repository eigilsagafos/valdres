import type { Readable } from "svelte/store"
import type { State, Store } from "valdres"

export const readable = <Value = any>(
    state: State<Value>,
    store: Store,
): Readable<Value> => {
    return {
        subscribe(run: (value: Value) => void) {
            run(store.get(state))
            return store.sub(state, () => {
                run(store.get(state))
            })
        },
    }
}
