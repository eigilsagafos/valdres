import type { State, Store } from "valdres"

type Subscriber<T> = (value: T) => void
type Unsubscriber = () => void

interface Readable<T> {
    subscribe(run: Subscriber<T>): Unsubscriber
}

export const toSvelteStore = <Value = any>(
    state: State<Value>,
    store: Store,
): Readable<Value> => {
    return {
        subscribe(run: Subscriber<Value>): Unsubscriber {
            run(store.get(state))
            return store.sub(state, () => {
                run(store.get(state))
            })
        },
    }
}
