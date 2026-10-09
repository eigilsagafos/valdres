import React, { useDebugValue, useEffect, useReducer } from "react"
import type { Atom, ExtractAtomValue, Store } from "./types/jotai"
import { createContinuablePromise } from "./lib/continuablePromise"
import { isPromiseLike } from "./lib/promiseBox"
import { useStore } from "./useStore"

type Options = {
    store?: Store
    unstable_promiseStatus?: boolean
}

type PromiseWithStatus<Value> = PromiseLike<Value> & {
    status?: "pending" | "fulfilled" | "rejected"
    value?: Value
    reason?: unknown
}

// Port of Jotai 3.0.1's useAtomValueRaw + useAtomValue (MIT).
const attachPromiseStatus = <Value>(promise: PromiseWithStatus<Value>) => {
    if (!promise.status) {
        promise.status = "pending"
        promise.then(
            value => {
                promise.status = "fulfilled"
                promise.value = value
            },
            reason => {
                promise.status = "rejected"
                promise.reason = reason
            },
        )
    }
}

const use =
    (React as { use?: <Value>(promise: PromiseLike<Value>) => Value }).use ||
    (<Value>(promise: PromiseWithStatus<Value>): Value => {
        if (promise.status === "pending") {
            throw promise
        } else if (promise.status === "fulfilled") {
            return promise.value as Value
        } else if (promise.status === "rejected") {
            throw promise.reason
        } else {
            attachPromiseStatus(promise)
            throw promise
        }
    })

type ReducerState = readonly [
    value: unknown,
    store: Store,
    atom: Atom<unknown>,
    subscribe: (callback: () => void) => () => void,
]

const createState = (
    store: Store,
    atom: Atom<unknown>,
    value: unknown,
): ReducerState => [
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

export function useAtomValue<Value>(
    atom: Atom<Value>,
    options?: Options,
): Awaited<Value>
export function useAtomValue<AtomType extends Atom<unknown>>(
    atom: AtomType,
    options?: Options,
): Awaited<ExtractAtomValue<AtomType>>
export function useAtomValue(atom: Atom<unknown>, options?: Options) {
    const { unstable_promiseStatus: promiseStatus = !React.use } = options || {}
    const store = useStore(options)
    const [
        [valueFromReducer, storeFromReducer, atomFromReducer, subscribe],
        rerender,
    ] = useReducer(
        (prev: ReducerState): ReducerState => {
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
        const continuable = createContinuablePromise(store, value, () =>
            store.get(atom),
        )
        if (promiseStatus) {
            attachPromiseStatus(continuable)
        }
        return use(continuable)
    }
    return value
}
