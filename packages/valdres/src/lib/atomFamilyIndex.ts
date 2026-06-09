import type { AtomFamilyAtom } from "../types/AtomFamilyAtom"
import type { Family } from "../types/Family"
import type { StoreData } from "../types/StoreData"
import { trackScopeValue } from "./trackScopeValue"

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
export const initFamilyIndex = (family: Family<any>, data: StoreData) => {
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

export const recursivelyUpdateIndexes = (
    data: StoreData,
    family: Family<any>,
) => {
    const childScopesWithFamily = data.scopeValueIndex.get(family)
    if (!childScopesWithFamily || childScopesWithFamily.size === 0) return
    // The parent's family index object can be REPLACED, not just mutated: `del`
    // and `set` inside a transaction clone the family index, and the clone
    // becomes the parent's committed index. A child scope that shadows the
    // family still points its `parentIndex` at the old object, so its rendered
    // members would reflect the pre-transaction parent. Re-link to the parent's
    // current index before re-rendering. Outside a txn the parent index is
    // mutated in place, so `parentIndex` is already correct and this is a no-op.
    const parentIndex = data.values.get(family).__index
    for (const scopedData of childScopesWithFamily) {
        const index = scopedData.values.get(family).__index
        index.parentIndex = parentIndex
        index.rendered = null
        index.renderedArray = null
        scopedData.values.set(family, renderAtomFamilyIndex(index))
        recursivelyUpdateIndexes(scopedData, family)
    }
}

// A scope can materialize its OWN family index through a path that did NOT walk
// the ancestor chain — specifically a transaction commit, which writes a flat
// rendered index whose parentIndex points at the nearest ANCESTOR that happened
// to already have an index, skipping any intermediate scopes. That violates the
// initFamilyIndex invariant ("a scope at depth N has an index ⇒ all ancestors
// do, each registered in its parent's scopeValueIndex"), so recursivelyUpdateIndexes
// can't reach the scope and it goes stale on a later parent membership change.
//
// This reuses initFamilyIndex (the single source of truth for the chain walk) to
// materialize + register every intermediate ancestor, then re-links this scope's
// index to its IMMEDIATE parent so inheritance and reachability flow level by
// level. Idempotent: a no-op once the chain already links up (the common
// direct-child-of-root case never relinks).
export const ensureFamilyAncestorChain = (
    family: Family<any>,
    data: StoreData,
) => {
    if (!data.parent) return
    const parentIndex = initFamilyIndex(family, data.parent)
    const own = data.values.get(family).__index
    if (own.parentIndex !== parentIndex) {
        own.parentIndex = parentIndex
        own.rendered = null
        own.renderedArray = null
        data.values.set(family, renderAtomFamilyIndex(own))
        recursivelyUpdateIndexes(data, family)
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
