import { isPromiseLike, type Atom, type State } from "valdres"
import { useMemo, useSyncExternalStore } from "react"
import { useValdresStore } from "./useValdresStore"

export const useValdresValueWithDefault = <V>(
    atom: Atom<V>,
    defaultValue: V | (() => V),
    deps = [],
) => {
    const store = useValdresStore()
    const defaultMemoized = useMemo(() => defaultValue, deps)
    const res = useSyncExternalStore(
        cb => store.sub(atom, cb, false),
        () => store.getWithDefault(atom, defaultMemoized),
    )
    if (isPromiseLike(res)) {
        throw res
    } else {
        return res
    }
}
