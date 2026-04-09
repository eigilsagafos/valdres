import { customRef, onScopeDispose, type Ref } from "vue"
import { isPromiseLike, type Atom, type Store } from "valdres"
import { useStore } from "./useStore"

export const useAtom = <V>(atom: Atom<V>, store?: Store): Ref<V> => {
    const currentStore = store || useStore()
    const initial = currentStore.get(atom)

    if (isPromiseLike(initial)) {
        throw initial
    }

    let triggerRef: () => void

    const ref = customRef<V>((track, trigger) => {
        triggerRef = trigger
        return {
            get() {
                track()
                return currentStore.get(atom) as V
            },
            set(value: V) {
                // @ts-ignore @ts-todo
                currentStore.set(atom, value)
            },
        }
    })

    // @ts-ignore
    const unsub = currentStore.sub(
        atom,
        () => {
            triggerRef()
        },
        false,
    )

    onScopeDispose(() => {
        unsub()
    })

    return ref
}
