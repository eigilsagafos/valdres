import type { Atom, SetAtomValue } from "valdres"
import { useSetValdresState } from "./useSetValdresState"
import { useValdresValue } from "./useValdresValue"

export const useValdresState = <V>(
    atom: Atom<V>,
): [V | Promise<V>, (value: SetAtomValue<V>) => void] => {
    const result = useValdresValue(atom)
    return [result, useSetValdresState(atom)]
}
