import equal from "fast-deep-equal"
import { initAtom } from "./initAtom"
import { initSelector } from "./initSelector"
import { isAtom } from "../utils/isAtom"
import { isAtomFamily } from "../utils/isAtomFamily"
import { isSelector } from "../utils/isSelector"
import { isSelectorFamily } from "../utils/isSelectorFamily"
import type { StoreData } from "../types/StoreData"
import type { Atom } from "../types/Atom"
import type { AtomFamily } from "../types/AtomFamily"
import type { Selector } from "../types/Selector"
import type { Family } from "../types/Family"

export function getState<V, K>(atom: Atom<V>, data: StoreData): V
export function getState<V, K>(selector: Selector<V>, data: StoreData): V
export function getState<V, K>(family: AtomFamily<V, K>, data: StoreData): K[]

export function getState<V, K>(
    state: Atom<V> | Selector<V> | Family<V, K>,
    data: StoreData,
) {
    if (data.values.has(state)) return data.values.get(state)
    if (isAtom<V>(state)) return initAtom<V>(state, data)
    if (isSelector<V>(state)) return initSelector<V>(state, data)
    if (isAtomFamily<V, K>(state)) {
        // TODO: Impement more efficient way to solve this
        const array = Array.from(state.__valdresAtomFamilyMap.keys())
        // @ts-ignore
        if (equal(array, state._keyArray)) return state._keyArray
        // @ts-ignore
        state._keyArray = array
        return array
    }
    if (isSelectorFamily(state)) {
        // TODO: Impement more efficient way to solve this
        const array = Array.from(state.__valdresSelectorFamilyMap.keys())
        // @ts-ignore
        if (equal(array, state._keyArray)) return state._keyArray
        // @ts-ignore
        state._keyArray = array
        return array
    }
    throw new Error("Invalid object passed to get")
}
