import type { Atom } from "../types/Atom"
import type { AtomFamily } from "../types/AtomFamily"
import type { AtomFamilyAtom } from "../types/AtomFamilyAtom"
import type { StoreData } from "../types/StoreData"
import { getRegisteredName } from "./registerName"

type NamedState = Atom<any> | AtomFamily<any>
export type NamedStateIndex = Map<NamedState, string>

/**
 * Stores use WeakMaps for state values, so those values cannot be enumerated by
 * dehydrate. Keep a lazy side index containing only globally addressable state
 * this store has materialized. The WeakMap key means the index does not extend
 * a store's lifetime; family members are represented by their already-global
 * family, never retained individually here.
 */
const indexes = new WeakMap<StoreData, NamedStateIndex>()

export const trackNamedState = (
    state: Atom<any> | AtomFamilyAtom<any, any>,
    data: StoreData,
): void => {
    // Directly named atoms are present in the reverse registry. Family members
    // are represented by their registered family, never by member identity.
    // Avoid probing `state.name`: it is mutable and is not the registry source
    // of truth, and on Bun/JSC the optional-property read perturbs the hot atom
    // property-access shape after initialization.
    let namedState: NamedState = state
    let name = getRegisteredName(state)
    if (name === undefined) {
        const family = (state as AtomFamilyAtom<any, any>).family
        if (family === undefined) return
        namedState = family
        name = getRegisteredName(family)
        if (name === undefined) return
    }

    let index = indexes.get(data)
    if (index === undefined) {
        index = new Map()
        indexes.set(data, index)
    }
    index.set(namedState, name)
}

/** Remove a directly registered atom after its own store value disappears. */
export const untrackNamedAtom = (atom: Atom<any>, data: StoreData): void => {
    if (getRegisteredName(atom) === undefined) return
    const index = indexes.get(data)
    if (index === undefined) return
    index.delete(atom)
    if (index.size === 0) indexes.delete(data)
}

export const getNamedStateIndex = (
    data: StoreData,
): NamedStateIndex | undefined => indexes.get(data)
