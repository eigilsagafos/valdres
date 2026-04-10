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
        throw new Error(
            "injectAtom() received async state. Atoms should have synchronous default values.",
        )
    }

    const inner = signal(initial as V)

    // Save the original signal .set before overriding — the subscription
    // must update the Angular signal directly, not go through the store.
    const signalSet = inner.set.bind(inner)

    // @ts-ignore
    const unsub = currentStore.sub(
        atom,
        () => {
            const newValue = currentStore.get(atom)
            if (!isPromiseLike(newValue)) {
                signalSet(newValue as V)
            }
        },
        false,
    )

    destroyRef.onDestroy(() => {
        unsub()
    })

    // Override set/update/reset to write through the valdres store while
    // also updating the Angular signal synchronously. This ensures
    // read-after-write consistency even with batchUpdates: true, where
    // store subscriptions fire asynchronously on microtask.
    const atomSignal = inner as unknown as AtomSignal<V>

    atomSignal.set = (value: V) => {
        signalSet(value)
        // @ts-ignore @ts-todo
        currentStore.set(atom, value as SetAtomValue<V>)
    }

    atomSignal.update = (fn: (value: V) => V) => {
        const next = fn(inner())
        signalSet(next)
        // @ts-ignore @ts-todo
        currentStore.set(atom, next as SetAtomValue<V>)
    }

    atomSignal.reset = () => {
        currentStore.reset(atom)
        const resetValue = currentStore.get(atom)
        if (!isPromiseLike(resetValue)) {
            signalSet(resetValue as V)
        }
    }

    return atomSignal
}
