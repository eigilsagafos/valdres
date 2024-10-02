import { initAtom } from "./initAtom"
import { initSelector } from "./initSelector"
import { isAtom } from "../utils/isAtom"
import { isSelector } from "../utils/isSelector"
import { isFamily } from "../utils/isFamily"
import type { State } from "../types/State"
import type { StoreData } from "../types/StoreData"
import type { Atom } from "../types/Atom"
import type { AtomFamily } from "../types/AtomFamily"
import type { Selector } from "../types/Selector"
import type { Family } from "../types/Family"

export function getState<V, K>(atom: Atom<V>, data: StoreData): V
export function getState<V, K>(selector: Selector<V>, data: StoreData): V
export function getState<V, K>(
    family: AtomFamily<unknown, K>,
    data: StoreData,
): K[]

export function getState<V, K>(
    state: State<V> | Family<V, K>,
    data: StoreData,
) {
    if (data.values.has(state)) return data.values.get(state)
    if (isAtom(state)) return initAtom<V>(state, data)
    if (isSelector(state)) return initSelector<V>(state, data)
    if (isFamily(state))
        return Array.from((state as AtomFamily<V, any>)._map.keys())
    throw new Error("Invalid object passed to get")
}
