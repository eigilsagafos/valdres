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
import { createStoreData } from "./createStoreData"
import { initAtom } from "./initAtom"
import { initSelector } from "./initSelector"

const getScopedData = (data: StoreData, scopeId: string) => {
    if (scopeId in data.scopes) return data.scopes[scopeId]
    data.scopes[scopeId] = createStoreData(`${data.id}:${scopeId}`, data)
    return data.scopes[scopeId]
}
const findInParents = <V, K>(
    data: StoreData,
    state: Atom<V> | Selector<V> | Family<V, K>,
) => {
    if (data.values.has(state)) return data.values.get(state)
    throw new Error("todo")
}

export function getState<V, K>(
    atom: Atom<V>,
    data: StoreData,
    scopeId?: string,
): V
export function getState<V, K>(
    selector: Selector<V>,
    data: StoreData,
    scopeId?: string,
): V
export function getState<V, K>(
    family: AtomFamily<V, K>,
    data: StoreData,
    scopeId?: string,
): K[]

export function getState<V, K>(
    state: Atom<V> | Selector<V> | Family<K, V>,
    data: StoreData,
    scopeId?: string,
) {
    if (scopeId) {
        data = getScopedData(data, scopeId)
        if (!data.values.has(state)) {
            if (!data.parent) throw new Error("Scope store not found")
            const value = findInParents(data.parent, state)
            if (value) return value
        }
    }
    if (data.values.has(state)) return data.values.get(state)
    if (isAtom<V>(state)) return initAtom<V>(state, data)
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
