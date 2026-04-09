import type { Atom, SetAtomValue, Store } from "valdres"
import { getValue } from "./getValue.svelte"
import { getSetter } from "./getSetter"
import { getReset } from "./getReset"

export const getAtom = <V>(
    atom: Atom<V>,
    store?: Store,
): {
    readonly value: V
    set: (value: SetAtomValue<V>) => void
    reset: () => void
} => {
    const reactive = getValue(atom, store)
    return {
        get value() {
            return reactive.value
        },
        set: getSetter(atom, store),
        reset: getReset(atom, store),
    }
}
