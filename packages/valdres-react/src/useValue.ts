import { useCallback, useMemo, useSyncExternalStore } from "react"
import type { State, Store } from "valdres"
import {
    assertStore,
    read,
    readHydrationSnapshot,
    subscribe,
} from "valdres/adapter-internals/v1"
import { useSelectedStore } from "./lib/useSelectedStore"

interface HydrationOutcome<Value> {
    readonly didThrow: boolean
    readonly result: Value | unknown
}

const createHydrationReader = <Value>(
    store: Store,
    state: State<Value>,
): (() => Value) => {
    let outcome: HydrationOutcome<Value> | undefined

    return () => {
        assertStore(store)

        if (outcome === undefined) {
            try {
                outcome = {
                    didThrow: false,
                    result: readHydrationSnapshot(store, state),
                }
            } catch (error) {
                outcome = { didThrow: true, result: error }
            }
        }

        if (outcome.didThrow) throw outcome.result
        return outcome.result as Value
    }
}

export const useValue = <Value>(state: State<Value>, store?: Store): Value => {
    const selectedStore = useSelectedStore(store)
    const subscribeToState = useCallback(
        (callback: () => void) => subscribe(selectedStore, state, callback),
        [selectedStore, state],
    )
    const getSnapshot = useCallback(
        () => read(selectedStore, state),
        [selectedStore, state],
    )
    const getServerSnapshot = useMemo(
        () => createHydrationReader(selectedStore, state),
        [selectedStore, state],
    )

    return useSyncExternalStore(
        subscribeToState,
        getSnapshot,
        getServerSnapshot,
    )
}
