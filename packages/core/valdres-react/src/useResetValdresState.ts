import { useCallback } from "react"
import { useValdresStore } from "./useValdresStore"
import type { Atom } from "valdres"

export const useResetValdresState = <V>(atom: Atom<V>): (() => void) => {
    const store = useValdresStore()
    return useCallback(() => store.reset(atom), [atom, store])
}
