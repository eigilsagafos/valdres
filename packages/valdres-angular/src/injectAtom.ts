import { signal, DestroyRef, inject, type WritableSignal } from "@angular/core"
import { isPromiseLike, type Atom, type SetAtomValue, type Store } from "valdres"
import { injectStore } from "./injectStore"

export type AtomSignal<V> = WritableSignal<V> & {
    reset: () => void
}

export const injectAtom = <V>(atom: Atom<V>, store?: Store): AtomSignal<V> => {
    const currentStore = store || injectStore()
    const destroyRef = inject(DestroyRef)
    const initial = currentStore.get(atom)

    if (isPromiseLike(initial)) {
        throw initial
    }

    const inner = signal(initial as V)

    // @ts-ignore
    const unsub = currentStore.sub(
        atom,
        () => {
            const newValue = currentStore.get(atom)
            if (!isPromiseLike(newValue)) {
                inner.set(newValue as V)
            }
        },
        false,
    )

    destroyRef.onDestroy(() => {
        unsub()
    })

    // Override set/update to write through the valdres store (which triggers
    // the subscription above, keeping the inner signal in sync).
    // Preserves the real SIGNAL brand so effect()/computed()/templates work.
    const atomSignal = inner as unknown as AtomSignal<V>

    atomSignal.set = (value: V) => {
        // @ts-ignore @ts-todo
        currentStore.set(atom, value as SetAtomValue<V>)
    }

    atomSignal.update = (fn: (value: V) => V) => {
        const current = currentStore.get(atom) as V
        // @ts-ignore @ts-todo
        currentStore.set(atom, fn(current) as SetAtomValue<V>)
    }

    atomSignal.reset = () => {
        currentStore.reset(atom)
    }

    return atomSignal
}
