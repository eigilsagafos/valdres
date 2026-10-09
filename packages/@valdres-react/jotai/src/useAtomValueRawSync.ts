import { useCallback, useDebugValue, useSyncExternalStore } from "react"
import type { Atom, ExtractAtomValue, Store } from "./types/jotai"
import { createContinuablePromise } from "./lib/continuablePromise"
import { isPromiseLike } from "./lib/promiseBox"
import { useStore } from "./useStore"

type Options = { store?: Store }

// Port of Jotai 3.0.1's useAtomValueRawSync (MIT): useSyncExternalStore, never
// suspends.
export function useAtomValueRawSync<Value>(
    atom: Atom<Value>,
    options?: Options,
): Value
export function useAtomValueRawSync<AtomType extends Atom<unknown>>(
    atom: AtomType,
    options?: Options,
): ExtractAtomValue<AtomType>
export function useAtomValueRawSync<Value>(
    atom: Atom<Value>,
    options?: Options,
) {
    const store = useStore(options)
    const getSnapshot = useCallback(() => {
        const value = store.get(atom)
        if (isPromiseLike(value)) {
            return createContinuablePromise(store, value, () => store.get(atom))
        }
        return value
    }, [store, atom])
    const value = useSyncExternalStore(
        useCallback(
            (callback: () => void) => store.sub(atom, callback),
            [store, atom],
        ),
        getSnapshot,
        getSnapshot,
    )
    useDebugValue(value)
    return value
}
