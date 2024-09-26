import type { Atom, SetAtomValue } from "valdres"
import { useSyncExternalStore } from "react"
import { useValdresStore } from "./useValdresStore"
import { useSetValdresState } from "./useSetValdresState"

export const useValdresState = <V>(
    atom: Atom<V>,
): [V | Promise<V>, (value: SetAtomValue<V>) => void] => {
    const store = useValdresStore()
    const result = useSyncExternalStore(
        cb => store.sub(atom, cb, false),
        () => store.get(atom),
    )
    return [result, useSetValdresState(atom)]
}
