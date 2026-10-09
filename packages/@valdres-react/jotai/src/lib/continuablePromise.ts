import type { Store } from "../types/jotai"
import { isPromiseLike } from "./promiseBox"
import { runtimeOf } from "./runtime"

const continuablePromises = new WeakMap<
    PromiseLike<unknown>,
    Promise<unknown>
>()

/**
 * Port of Jotai 3.0.1's continuable promise (MIT): a promise a suspended
 * component can wait on that settles with the atom's value even when the atom
 * moves on to a different promise or value while it waits. Jotai learns that
 * from aborting the replaced promise; here the store re-reads the atom after
 * each operation while the promise is pending, which neither mounts the atom
 * nor recomputes it unless its dependencies changed.
 */
export const createContinuablePromise = <Value>(
    store: Store,
    promise: PromiseLike<Value>,
    getValue: () => PromiseLike<Value> | Value,
): PromiseLike<Value> => {
    const runtime = runtimeOf(store)
    if (runtime === undefined) return promise
    let continuable = continuablePromises.get(promise)
    if (!continuable) {
        continuable = new Promise((resolve, reject) => {
            let current: PromiseLike<Value> = promise
            let unwatch = () => {}
            const settle =
                <T>(fn: (value: T) => void) =>
                (value: T) => {
                    unwatch()
                    fn(value)
                }
            const onFulfilled = (me: PromiseLike<Value>) => (value: Value) => {
                if (current === me) settle(resolve)(value)
            }
            const onRejected =
                (me: PromiseLike<Value>) => (reason: unknown) => {
                    if (current === me) settle(reject)(reason)
                }
            promise.then(onFulfilled(promise), onRejected(promise))
            unwatch = runtime.watch(() => {
                let next: PromiseLike<Value> | Value
                try {
                    next = getValue()
                } catch (error) {
                    settle(reject)(error)
                    return
                }
                if (Object.is(next, current)) return
                if (isPromiseLike(next)) {
                    continuablePromises.set(next, continuable!)
                    current = next
                    next.then(onFulfilled(next), onRejected(next))
                } else {
                    settle(resolve)(next)
                }
            })
        })
        continuablePromises.set(promise, continuable)
    }
    return continuable as PromiseLike<Value>
}
