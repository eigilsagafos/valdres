import { useCallback } from "react"
import type { Atom } from "@valdres/core"
import { useValdresStore } from "./useValdresStore"
// import { initAtom } from "./lib/initAtom"

export const useResetValdresState = <V>(atom: Atom<V>): (() => void) => {
    const store = useValdresStore()
    return useCallback(() => {
        store.reset(atom)
        // initAtom(atom, store.data)
    }, [atom])
}
