import type { Atom, SetAtomValue } from "valdres"
import { useSetAtom } from "./useSetAtom"
import { useValue } from "./useValue"

export const useAtom = <V>(
    atom: Atom<V>,
): [V | Promise<V>, (value: SetAtomValue<V>) => void] => {
    const result = useValue(atom)
    return [result, useSetAtom(atom)]
}
