import equal from "fast-deep-equal"
import type { Atom } from "../types/Atom"
import type { AtomFamily } from "../types/AtomFamily"
import type { Family } from "../types/Family"
import type { Selector } from "../types/Selector"
import type { StoreData } from "../types/StoreData"
import { isAtom } from "../utils/isAtom"
import { isAtomFamily } from "../utils/isAtomFamily"
import { isSelector } from "../utils/isSelector"
import { isSelectorFamily } from "../utils/isSelectorFamily"
import { initAtom } from "./initAtom"
import { initSelector } from "./initSelector"

export function getState<V, K>(atom: Atom<V>, data: StoreData): V
export function getState<V, K>(selector: Selector<V>, data: StoreData): V
export function getState<V, K>(family: AtomFamily<V, K>, data: StoreData): K[]

export function getState<V, K>(
    state: Atom<V> | Selector<V> | Family<K, V>,
    data: StoreData,
) {
    if (data.values.has(state)) return data.values.get(state)
    if (isAtom<V>(state)) {
        if (data.parent) return getState<V, K>(state, data.parent)
        return initAtom<V>(state, data)
    }
    if (isSelector<V>(state)) return initSelector<V>(state, data)
    if (isAtomFamily<K, V>(state)) {
        // TODO: Impement more efficient way to solve this
        const array = Array.from(state.__valdresAtomFamilyMap.keys())
        // @ts-ignore
        if (equal(array, state._keyArray)) return state._keyArray
        // @ts-ignore
        state._keyArray = array
        return array
    }
    if (isSelectorFamily<K, V>(state)) {
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
