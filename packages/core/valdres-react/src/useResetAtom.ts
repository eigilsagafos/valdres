import { useCallback } from "react"
import { useStore } from "./useStore"
import type { Atom } from "valdres"

export const useResetAtom = <V>(atom: Atom<V>): (() => void) => {
    const store = useStore()
    return useCallback(() => store.reset(atom), [atom, store])
}
