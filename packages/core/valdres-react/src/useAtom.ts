import type { Atom, SetAtomValue, Store } from "valdres"
import { useSetAtom } from "./useSetAtom"
import { useValue } from "./useValue"

export const useAtom = <V>(
    atom: Atom<V>,
    store?: Store,
): [V | Promise<V>, (value: SetAtomValue<V>) => void] => {
    return [useValue(atom, store), useSetAtom(atom, store)]
}
