import type { Atom, SetAtomValue, Store } from "valdres"
import { useValue } from "./useValue.svelte"
import { useSetAtom } from "./useSetAtom"

export const useAtom = <V>(
    atom: Atom<V>,
    store?: Store,
): [{ readonly current: V }, (value: SetAtomValue<V>) => void] => {
    return [useValue(atom, store), useSetAtom(atom, store)]
}
