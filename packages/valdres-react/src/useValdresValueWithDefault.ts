import {
    isPromiseLike,
    isAtom,
    type Atom,
    type Store,
    type GetValue,
} from "valdres"
import { useMemo, useSyncExternalStore } from "react"
import { useStore } from "./useStore"

const isFunction = <V>(value: any): value is (get: GetValue) => V => {
    return typeof value === "function"
}

const getWithDefault = <V>(
    atom: Atom<V>,
    defaultValue: V | ((get: GetValue) => V),
    store: Store,
) => {
    if (!isAtom(atom)) throw new Error("Only atom allowed")
    // Use store.get() so pending implicit transactions are visible.
    const value = store.get(atom)
    // An uninitialized atom() with no default returns a promise
    // (the "empty atom promise"). In that case, apply the default.
    if (isPromiseLike(value)) {
        if (isFunction(defaultValue)) {
            defaultValue = defaultValue(store.get)
        }
        store.data.values.set(atom, defaultValue)
        return defaultValue
    }
    return value
}

export const useValdresValueWithDefault = <V>(
    atom: Atom<V>,
    defaultValue: V | (() => V),
    deps = [],
) => {
    const store = useStore()
    const defaultMemoized = useMemo(() => defaultValue, deps)
    const res = useSyncExternalStore(
        cb => store.sub(atom, cb, false),
        () => getWithDefault(atom, defaultMemoized, store),
    )
    if (isPromiseLike(res)) {
        throw res
    } else {
        return res
    }
}
