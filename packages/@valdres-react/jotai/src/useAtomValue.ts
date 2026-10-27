import React from "react"
import type { Atom, ExtractAtomValue, Store } from "./types/jotai"
import { isPromiseLike } from "./lib/promiseBox"
import { useAtomValueRaw } from "./useAtomValueRaw"

type Options = {
    store?: Store
    unstable_promiseStatus?: boolean
}

type PromiseWithStatus<Value> = PromiseLike<Value> & {
    status?: "pending" | "fulfilled" | "rejected"
    value?: Value
    reason?: unknown
}

// Port of Jotai 3.0.1's useAtomValue (MIT).
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
    // A shim for React 18
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
    const value = useAtomValueRaw(atom, options)
    if (isPromiseLike(value)) {
        if (promiseStatus) {
            attachPromiseStatus(value)
        }
        return use(value)
    }
    return value
}
