import type { DeepReadonly, Ref } from "vue"
import type { Atom, SetAtomValue, Store } from "valdres"
import { useValue } from "./useValue"
import { useSetAtom } from "./useSetAtom"

export const useAtom = <V>(
    atom: Atom<V>,
    store?: Store,
): [DeepReadonly<Ref<V>>, (value: SetAtomValue<V>) => void] => {
    return [useValue(atom, store), useSetAtom(atom, store)]
}
