import { useCallback, useMemo, useSyncExternalStore } from "react"
import type { State, Store } from "valdres"
import {
    read,
    readHydrationSnapshot,
    subscribe,
} from "valdres/adapter-internals/v1"
import { unwrapError } from "./unwrapError"

const readOrThrowCause = <Value>(readValue: () => Value): Value => {
    try {
        return readValue()
    } catch (error) {
        throw unwrapError(error)
    }
}

/**
 * Subscribes a component to a State through the documented adapter surface.
 * Failures reach error boundaries as the value the getter threw, as in Recoil.
 */
export const useNodeValue = <Value>(store: Store, state: State<Value>): Value => {
    const subscribeToState = useCallback(
        (callback: () => void) => subscribe(store, state, callback),
        [store, state],
    )
    const getSnapshot = useCallback(
        () => readOrThrowCause(() => read(store, state)),
        [store, state],
    )
    const getServerSnapshot = useMemo(() => {
        let outcome: { readonly threw: boolean; readonly result: unknown } | undefined
        return () => {
            if (outcome === undefined) {
                try {
                    outcome = { threw: false, result: readHydrationSnapshot(store, state) }
                } catch (error) {
                    outcome = { threw: true, result: unwrapError(error) }
                }
            }
            if (outcome.threw) throw outcome.result
            return outcome.result as Value
        }
    }, [store, state])
    return useSyncExternalStore(subscribeToState, getSnapshot, getServerSnapshot)
}
