import type { AtomFamily } from "../types/AtomFamily"
import type { AtomFamilyAtom } from "../types/AtomFamilyAtom"
import type { Family } from "../types/Family"
import type { StoreData } from "../types/StoreData"
import type {
    IndexDescriptor,
    IndexHookResult,
} from "./IndexDescriptor"
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
    // Root fast path: skip the Map-clone + O(N log N) sort. `index.created`
    // preserves insertion order (Map spec), and for root storage the
    // canonical render is just "atoms in the order they were added, minus
    // anything deleted." For a non-root index with a parent chain we still
    // walk + sort to merge with parent visibility.
    if (!index.parentIndex) {
        const deleted = index.deleted
        let array: AtomFamilyAtom<any, any>[]
        if (deleted.size === 0) {
            array = Array.from(index.created.keys())
        } else {
            array = []
            for (const atom of index.created.keys()) {
                if (!deleted.has(atom)) array.push(atom)
            }
        }
        // @ts-ignore
        array.__index = index
        // @ts-ignore
        index.renderedArray = array
        return array
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
    accum: IndexHookResult,
): void => {
    if (familyAtoms.size === 0) return
    const index = findFamilyIndex(family, data)
    // At root: just remove the atom from `created`. The `deleted`
    // tombstone is only load-bearing in a scope where it shadows a
    // parent's still-live entry — at root there is nothing to shadow,
    // so a tombstone is pure leak (both Map keys pin the atom).
    const isRoot = !index.parentIndex
    for (const atom of familyAtoms) {
        if (isRoot) {
            index.created.delete(atom)
        } else {
            index.deleted.set(atom, timestamp)
        }
    }
    index.rendered = null
    index.renderedArray = null
    markFamilyDirty(data, family)
    recursivelyUpdateIndexes(data, family)

    const descriptors = (family as AtomFamily<any, any>).__valdresIndexes
    if (!descriptors || descriptors.size === 0) return
    for (const descriptor of descriptors) {
        runDescriptorHook(
            descriptor,
            "onDelete",
            family as AtomFamily<any, any>,
            familyAtoms,
            data,
            accum,
        )
    }
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

/** Defer the rendered-array allocation until someone reads the family.
 *  Per-write rendering is O(M) and accumulates to O(N²) over N writes;
 *  marking dirty here and materializing in `getState` / `getDefault` keeps
 *  bulk no-txn inserts O(N) when no consumer is actively listening. */
const markFamilyDirty = (data: StoreData, family: Family<any>) => {
    if (!data.dirtyFamilies) data.dirtyFamilies = new Set()
    data.dirtyFamilies.add(family as unknown as WeakKey)
}

/** Materialize a dirty family's rendered array, store fresh, clear dirty.
 *  Shared between `getState` (selector-evaluator path) and `getDefault`
 *  (public-API path) — same operation, one implementation. */
export const materializeDirtyFamily = (
    state: WeakKey,
    data: StoreData,
): unknown => {
    const stored = data.values.get(state)
    if (!stored?.__index) {
        data.dirtyFamilies?.delete(state)
        return stored
    }
    const fresh = renderAtomFamilyIndex(stored.__index)
    data.values.set(state, fresh)
    data.dirtyFamilies?.delete(state)
    return fresh
}

const recursivelyUpdateIndexes = (data: StoreData, family: Family<any>) => {
    const childScopesWithFamily = data.scopeValueIndex.get(family)
    if (!childScopesWithFamily || childScopesWithFamily.size === 0) return
    for (const scopedData of childScopesWithFamily) {
        const index = scopedData.values.get(family).__index
        index.rendered = null
        index.renderedArray = null
        markFamilyDirty(scopedData, family)
        recursivelyUpdateIndexes(scopedData, family)
    }
}

export const addFamilyAtomsToSet = (
    family: Family<any>,
    familyAtoms: Set<AtomFamilyAtom<any>>,
    data: StoreData,
    timestamp: number,
    accum: IndexHookResult,
): void => {
    if (familyAtoms.size === 0) return
    const index = findFamilyIndex(family, data)
    if (!index) throw new Error("index not found")
    for (const atom of familyAtoms) {
        // Move re-set atoms to the end of insertion order so the skip-sort
        // root render reflects last-touched-last (matches the old
        // timestamp-sort contract). Fresh atoms skip the delete entirely.
        if (index.created.has(atom)) index.created.delete(atom)
        index.created.set(atom, timestamp)
        index.deleted.delete(atom)
    }
    index.rendered = null
    index.renderedArray = null
    markFamilyDirty(data, family)
    recursivelyUpdateIndexes(data, family)

    const descriptors = (family as AtomFamily<any, any>).__valdresIndexes
    if (!descriptors || descriptors.size === 0) return
    for (const descriptor of descriptors) {
        runDescriptorHook(
            descriptor,
            "onWrite",
            family as AtomFamily<any, any>,
            familyAtoms,
            data,
            accum,
        )
    }
}

/** Invoke a descriptor hook on each atom in `familyAtoms`. A throwing
 *  descriptor must not abort the whole propagation pass — the other
 *  descriptors still get to run, and the user-facing `store.set` /
 *  `store.del` completes. Errors are surfaced via `console.error` with
 *  enough context (family name, hook name) to locate the bad descriptor.
 *
 *  Design note: we catch *per atom*, not per descriptor. A single bad
 *  atom shouldn't disable indexing for the remaining atoms in the batch
 *  — but a descriptor that's now in an inconsistent state (e.g. partial
 *  bucket updates) is the bad-descriptor author's problem to fix. */
const runDescriptorHook = (
    descriptor: IndexDescriptor,
    hook: "onWrite" | "onDelete",
    family: AtomFamily<any, any>,
    familyAtoms: Set<AtomFamilyAtom<any>>,
    data: StoreData,
    accum: IndexHookResult,
): void => {
    for (const atom of familyAtoms) {
        try {
            descriptor[hook](family, atom, data, accum)
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error(
                `valdres: index descriptor ${hook} failed for family ` +
                    `"${family.name ?? "(anonymous)"}". The index may be ` +
                    `in an inconsistent state; subsequent reads of this ` +
                    `descriptor's results may be stale.`,
                error,
            )
        }
    }
}
