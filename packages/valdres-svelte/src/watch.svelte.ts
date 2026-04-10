import { isAtom, type Atom, type SetAtomValue, type State, type Store } from "valdres"
import { getValdresContext } from "./context"

interface WatchedValue<V> {
    readonly value: V
}

interface WatchedAtom<V> {
    readonly value: V
    set: (value: SetAtomValue<V>) => void
    reset: () => void
}

export function watch<V>(atom: Atom<V>, store?: Store): WatchedAtom<V>
export function watch<V>(state: State<V>, store?: Store): WatchedValue<V>
export function watch<V>(state: State<V>, store?: Store): WatchedValue<V> | WatchedAtom<V> {
    const resolvedStore = store || getValdresContext()
    let value = $state(resolvedStore.get(state))

    $effect.pre(() => {
        value = resolvedStore.get(state)
        const unsub = resolvedStore.sub(state, () => {
            value = resolvedStore.get(state)
        })
        return unsub
    })

    if (isAtom(state)) {
        return {
            get value() {
                return value
            },
            set: (v: SetAtomValue<V>) => resolvedStore.set(state, v),
            reset: () => resolvedStore.reset(state),
        }
    }

    return {
        get value() {
            return value
        },
    }
}
