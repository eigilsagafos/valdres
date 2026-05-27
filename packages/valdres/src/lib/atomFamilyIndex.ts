import type { AtomFamilyAtom } from "../types/AtomFamilyAtom"
import type { Family } from "../types/Family"
import type { StoreData } from "../types/StoreData"
import { trackScopeValue } from "./setValueInData"

// @ts-ignore
const getAtomFamilyRenderedMap = (
    index: ReturnType<typeof createAtomFamilyIndex>,
) => {
    if (index.rendered) return index.rendered
    // @ts-ignore
    const result = new Map(
        index.parentIndex
            ? getAtomFamilyRenderedMap(index.parentIndex)
            : undefined,
    )

    for (const [atom, timestamp] of index.created) {
        result.set(atom, timestamp)
    }
    for (const [atom, timestamp] of index.deleted) {
        result.delete(atom)
    }
    index.rendered = result
    return result
}

const getSortedKeysByValues = <K, V extends number | string>(
    map: Map<K, V>,
): K[] => {
    return Array.from(map.entries())
        .sort((a, b) => (a[1] > b[1] ? 1 : a[1] < b[1] ? -1 : 0))
        .map(entry => entry[0])
    // res.__in
}

export const renderAtomFamilyIndex = (index: AtomFamilyIndex) => {
    if (index.renderedArray) {
        return index.renderedArray
    }
    const renderedMap = getAtomFamilyRenderedMap(index)
    const array = getSortedKeysByValues(renderedMap)
    // @ts-ignore
    array.__index = index
    // @ts-ignore
    index.renderedArray = array
    return array
}

export type AtomFamilyIndex = {
    created: Map<AtomFamilyAtom<any, any>, number>
    deleted: Map<AtomFamilyAtom<any, any>, number>
    rendered: Map<AtomFamilyAtom<any, any>, number> | null
    renderedArray:
        | (AtomFamilyAtom<any, any>[] & { __index: AtomFamilyIndex })
        | null
    parentIndex?: AtomFamilyIndex
}

export const cloneAtomFamilyIndex = (
    index: AtomFamilyIndex,
    parentIndexOverride?: AtomFamilyIndex,
): AtomFamilyIndex => {
    return {
        created: new Map(index.created),
        deleted: new Map(index.deleted),
        rendered: null,
        renderedArray: null,
        parentIndex: parentIndexOverride || index.parentIndex,
    }
}

export const createAtomFamilyIndex = (
    parentIndex?: AtomFamilyIndex,
): AtomFamilyIndex => {
    return {
        created: new Map(),
        deleted: new Map(),
        rendered: null, // new Map(parentIndex?.rendered),
        renderedArray: null,
        parentIndex,
    }
}

export const deleteFamilyAtomsFromSet = (
    family: Family<any>,
    familyAtoms: Set<AtomFamilyAtom<any>>,
    data: StoreData,
    timestamp: number,
) => {
    if (familyAtoms.size === 0) return
    const index = findFamilyIndex(family, data)
    for (const atom of familyAtoms) {
        index.deleted.set(atom, timestamp)
    }
    index.rendered = null
    index.renderedArray = null
    data.values.set(family, renderAtomFamilyIndex(index))
    recursivelyUpdateIndexes(data, family)
}

// INVARIANT: initFamilyIndex walks up the ancestor chain, so when a scope
// at depth N gets a family index, all ancestors (depth 0..N-1) also get one.
// recursivelyUpdateIndexes relies on this: it only recurses into child scopes
// that appear in scopeValueIndex, trusting that intermediate scopes without
// the family have no descendants with it either.
const initFamilyIndex = (family: Family<any>, data: StoreData) => {
    if (data.values.has(family)) return data.values.get(family).__index
    let parentIndex
    if (data.parent) {
        parentIndex = initFamilyIndex(family, data.parent)
        if (!parentIndex) throw new Error("Parent index is missing")
    }
    const index = createAtomFamilyIndex(parentIndex)
    data.values.set(family, renderAtomFamilyIndex(index))
    if (data.parent) {
        trackScopeValue(family, data)
    }
    return index
}

const findFamilyIndex = (family: Family<any>, data: StoreData) => {
    if (!data.values.has(family)) {
        initFamilyIndex(family, data)
    }
    const value = data.values.get(family)
    if (!value?.__index) {
        throw new Error("Family index is missing")
    }

    return value.__index
}

const recursivelyUpdateIndexes = (data: StoreData, family: Family<any>) => {
    const childScopesWithFamily = data.scopeValueIndex.get(family)
    if (!childScopesWithFamily || childScopesWithFamily.size === 0) return
    for (const scopedData of childScopesWithFamily) {
        const index = scopedData.values.get(family).__index
        index.rendered = null
        index.renderedArray = null
        scopedData.values.set(family, renderAtomFamilyIndex(index))
        recursivelyUpdateIndexes(scopedData, family)
    }
}

export const addFamilyAtomsToSet = (
    family: Family<any>,
    familyAtoms: Set<AtomFamilyAtom<any>>,
    data: StoreData,
    timestamp: number,
) => {
    if (familyAtoms.size === 0) return
    const index = findFamilyIndex(family, data)
    if (!index) throw new Error("index not found")
    for (const atom of familyAtoms) {
        index.created.set(atom, timestamp)
        index.deleted.delete(atom)
    }
    index.rendered = null
    index.renderedArray = null
    data.values.set(family, renderAtomFamilyIndex(index))
    recursivelyUpdateIndexes(data, family)
}
