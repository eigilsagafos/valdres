import { useDebugValue, useEffect, useReducer } from "react"
import type { Atom, ExtractAtomValue, Store } from "./types/jotai"
import { createContinuablePromise } from "./lib/continuablePromise"
import { isPromiseLike } from "./lib/promiseBox"
import { useStore } from "./useStore"

type Options = { store?: Store }
type Subscribe = (callback: () => void) => () => void
type State<Value> = readonly [Value, Store, Atom<Value>, Subscribe]

// Port of Jotai 3.0.1's useAtomValueRaw (MIT): useReducer + useEffect, never
// suspends; an async atom's value is returned as a (continuable) promise.
const createState = <Value>(
    store: Store,
    atom: Atom<Value>,
    value: Value,
): State<Value> => [
    value,
    store,
    atom,
    callback => {
        const unsub = store.sub(atom, callback)
        let needsRerender = true
        try {
            needsRerender = !Object.is(value, store.get(atom))
        } catch {
            // Rerender on error.
        }
        if (needsRerender) {
            callback()
        }
        return unsub
    },
]

export function useAtomValueRaw<Value>(
    atom: Atom<Value>,
    options?: Options,
): Value
export function useAtomValueRaw<AtomType extends Atom<unknown>>(
    atom: AtomType,
    options?: Options,
): ExtractAtomValue<AtomType>
export function useAtomValueRaw<Value>(atom: Atom<Value>, options?: Options) {
    const store = useStore(options)
    const [
        [valueFromReducer, storeFromReducer, atomFromReducer, subscribe],
        rerender,
    ] = useReducer<State<Value>, undefined, []>(
        prev => {
            const nextValue = store.get(atom)
            if (prev[1] === store && prev[2] === atom) {
                return Object.is(prev[0], nextValue)
                    ? prev
                    : [nextValue, store, atom, prev[3]]
            }
            return createState(store, atom, nextValue)
        },
        undefined,
        () => createState(store, atom, store.get(atom)),
    )
    let value = valueFromReducer
    if (storeFromReducer !== store || atomFromReducer !== atom) {
        rerender()
        value = store.get(atom)
    }
    useEffect(() => subscribe(rerender), [subscribe])
    useDebugValue(value)
    if (isPromiseLike(value)) {
        return createContinuablePromise(store, value, () => store.get(atom))
    }
    return value
}
