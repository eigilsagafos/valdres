import { from, type Accessor } from "solid-js"
import { isPromiseLike, type Atom, type SetAtomValue, type Store } from "valdres"
import { useStore } from "./useStore"

type SetterFn<V> = (value: SetAtomValue<V>) => void

export const createAtom = <V>(
    atom: Atom<V>,
    store?: Store,
): [Accessor<V>, SetterFn<V>] => {
    const currentStore = store || useStore()
    const initial = currentStore.get(atom)

    if (isPromiseLike(initial)) {
        throw initial
    }

    const value = from<V>(set => {
        set(() => initial as V)
        // @ts-ignore
        return currentStore.sub(
            atom,
            () => {
                const next = currentStore.get(atom)
                if (!isPromiseLike(next)) {
                    set(() => next as V)
                }
            },
            false,
        )
    })

    // @ts-ignore
    const setter: SetterFn<V> = (val: SetAtomValue<V>) => currentStore.set(atom, val)

    return [value, setter]
}
