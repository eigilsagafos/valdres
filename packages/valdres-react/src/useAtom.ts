import type { Atom, Store } from "valdres"
import { useSetAtom } from "./useSetAtom"
import { useValue } from "./useValue"

export const useAtom = <Value>(
    atom: Atom<Value>,
    store?: Store,
): readonly [Value, (value: Value) => void] =>
    [useValue(atom, store), useSetAtom(atom, store)] as const
