import type { AtomFamily } from "../types/AtomFamily"
import type { AtomFamilyAtom } from "../types/AtomFamilyAtom"
import type { StoreData } from "../types/StoreData"
import { noteStateValueChanged } from "./stateRevisions"
import { stateNameSuffix } from "./stateNameForError"
import { trackScopeValue } from "./trackScopeValue"

const getAtomFamilyRenderedMap = (
    index: ReturnType<typeof createAtomFamilyIndex>,
): Map<AtomFamilyAtom<any, any>, number> => {
    if (index.rendered) return index.rendered
    const result = new Map(
        index.parentIndex
            ? getAtomFamilyRenderedMap(index.parentIndex)
            : undefined,
    )

    for (const [atom, timestamp] of index.created) {
        result.set(atom, timestamp)
    }
    for (const [atom] of index.deleted) {
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
}

type RenderedAtomFamilyIndex = readonly AtomFamilyAtom<any, any>[] & {
    readonly __index: AtomFamilyIndex
}

export const renderAtomFamilyIndex = (
    index: AtomFamilyIndex,
): RenderedAtomFamilyIndex => {
    if (index.renderedArray) {
        return index.renderedArray
    }
    const renderedMap = getAtomFamilyRenderedMap(index)
    const snapshot = getSortedKeysByValues(renderedMap)
    Object.defineProperty(snapshot, "__index", { value: index })
    Object.freeze(snapshot)
    // Object.defineProperty does not refine the array's static type.
    const renderedSnapshot = snapshot as unknown as RenderedAtomFamilyIndex
    index.renderedArray = renderedSnapshot
    return renderedSnapshot
}

/** A membership snapshot nobody has looked at yet. It stands in for the
 *  rendered array in `data.values` and carries the live index, so every
 *  `__index` consumer — and `values.has`, which answers "does this store own
 *  the family" — keeps working while the copy + sort is deferred. */
const deferredFamilyIndexValue = (
    index: AtomFamilyIndex,
): RenderedAtomFamilyIndex => {
    const deferred: AtomFamilyAtom<any, any>[] = []
    Object.defineProperty(deferred, "__index", { value: index })
    return deferred as unknown as RenderedAtomFamilyIndex
}

/** Publish a membership change WITHOUT rendering its snapshot. The change is
 *  visible immediately through the index; the array readers see is materialized
 *  at the first observation boundary (`renderDirtyFamilyIndex`).
 *
 *  Rendering here instead would copy + sort + freeze all K members on every one
 *  of K writes, making a loop of direct `set`/`del` calls O(K² log K) — the
 *  transaction path has always deferred this to its commit boundary (see
 *  `dirtyFamilyIndexes` in transaction.ts), and this is the same deferral for
 *  the direct path. Guarded by atomFamilyIndexScaling.test.ts. */
const publishFamilyIndex = (
    family: AtomFamily<any, any>,
    index: AtomFamilyIndex,
    data: StoreData,
) => {
    index.rendered = null
    index.renderedArray = null
    data.values.set(family, deferredFamilyIndexValue(index))
    const dirty = data.dirtyFamilyIndexes
    if (dirty === undefined) {
        data.dirtyFamilyIndexes = new WeakSet([family])
        data.dirtyFamilyIndexCount = 1
    } else if (!dirty.has(family)) {
        dirty.add(family)
        data.dirtyFamilyIndexCount++
    }
    noteStateValueChanged(family, data)
}

/** Observation boundary: materialize the membership snapshot `family` currently
 *  defers in `data`, publish it as the family's value, and return it.
 *
 *  Call sites reach this only after finding `family` in `data.dirtyFamilyIndexes`
 *  — one field load on a read hot path, `undefined` until this store changes a
 *  family's membership. The snapshot is re-derived from whatever index the store
 *  holds NOW, so a value another path rendered in the meantime (a transaction
 *  commit renders its own) is returned unchanged and the stale dirty marker is
 *  simply dropped. */
export const renderDirtyFamilyIndex = (
    family: AtomFamily<any, any>,
    data: StoreData,
): RenderedAtomFamilyIndex | undefined => {
    data.dirtyFamilyIndexes!.delete(family)
    if (--data.dirtyFamilyIndexCount === 0) {
        data.dirtyFamilyIndexes = undefined
    }
    const deferred = data.values.get(family)
    if (deferred === undefined) return undefined
    const rendered = renderAtomFamilyIndex(deferred.__index)
    if (rendered !== deferred) data.values.set(family, rendered)
    return rendered
}

/** `renderDirtyFamilyIndex` behind its own guard, for family reads that aren't
 *  on a hot path. */
export const observeFamilyIndex = (
    family: AtomFamily<any, any>,
    data: StoreData,
): RenderedAtomFamilyIndex | undefined =>
    data.dirtyFamilyIndexes !== undefined && data.dirtyFamilyIndexes.has(family)
        ? renderDirtyFamilyIndex(family, data)
        : data.values.get(family)

/** Whether this index itself owns a live member. Parent membership is
 *  deliberately ignored: a scoped write to an inherited member must still
 *  create a local ownership entry so a later parent delete does not remove the
 *  scope's member. */
export const hasOwnFamilyAtom = (
    index: AtomFamilyIndex,
    atom: AtomFamilyAtom<any, any>,
) => index.created.has(atom) && !index.deleted.has(atom)

export type AtomFamilyIndex = {
    created: Map<AtomFamilyAtom<any, any>, number>
    deleted: Map<AtomFamilyAtom<any, any>, number>
    rendered: Map<AtomFamilyAtom<any, any>, number> | null
    renderedArray: RenderedAtomFamilyIndex | null
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
    family: AtomFamily<any, any>,
    familyAtoms: Set<AtomFamilyAtom<any>>,
    data: StoreData,
    timestamp: number,
) => {
    if (familyAtoms.size === 0) return
    const index = findFamilyIndex(family, data)
    for (const atom of familyAtoms) {
        // Drop the creation entry rather than shadowing it with a tombstone.
        // A render walks BOTH maps, and once deleted only the tombstone carries
        // meaning: it masks an inherited member and stops a read of the deleted
        // member from re-registering it. Keeping the pair would have a render
        // insert the member and then remove it again — two entries walked per
        // deleted member instead of one. The tombstone itself must stay, so a
        // render remains proportional to live members PLUS everything this index
        // has ever deleted. Matches how `del` maintains a transaction's index.
        index.created.delete(atom)
        index.deleted.set(atom, timestamp)
    }
    publishFamilyIndex(family, index, data)
    recursivelyUpdateIndexes(data, family)
}

// INVARIANT: initFamilyIndex walks up the ancestor chain, so when a scope
// at depth N gets a family index, all ancestors (depth 0..N-1) also get one.
// recursivelyUpdateIndexes relies on this: it only recurses into child scopes
// that appear in scopeValueIndex, trusting that intermediate scopes without
// the family have no descendants with it either.
export const initFamilyIndex = (
    family: AtomFamily<any, any>,
    data: StoreData,
) => {
    if (data.values.has(family)) return data.values.get(family).__index
    let parentIndex
    if (data.parent) {
        parentIndex = initFamilyIndex(family, data.parent)
        if (!parentIndex)
            throw new Error(
                `valdres: parent index is missing for atomFamily${stateNameSuffix(family)} in store '${data.id}'`,
            )
    }
    const index = createAtomFamilyIndex(parentIndex)
    publishFamilyIndex(family, index, data)
    if (data.parent) {
        trackScopeValue(family, data)
    }
    return index
}

const findFamilyIndex = (family: AtomFamily<any, any>, data: StoreData) => {
    if (!data.values.has(family)) {
        initFamilyIndex(family, data)
    }
    const value = data.values.get(family)
    if (!value?.__index) {
        throw new Error(
            `valdres: family index is missing for atomFamily${stateNameSuffix(family)} in store '${data.id}'`,
        )
    }

    return value.__index
}

export const recursivelyUpdateIndexes = (
    data: StoreData,
    family: AtomFamily<any, any>,
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
        publishFamilyIndex(family, index, scopedData)
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
    family: AtomFamily<any, any>,
    data: StoreData,
) => {
    if (!data.parent) return
    const parentIndex = initFamilyIndex(family, data.parent)
    const own = data.values.get(family).__index
    if (own.parentIndex !== parentIndex) {
        own.parentIndex = parentIndex
        publishFamilyIndex(family, own, data)
        recursivelyUpdateIndexes(data, family)
    }
}

// Returns whether this store's family MEMBERSHIP changed (a member was newly
// added or un-deleted) — as opposed to an existing member's value being
// re-set. Callers use this to skip propagating the family OBJECT into scopes on
// a pure value update: scope selectors that read a member's value recompute via
// the member atom, so only a membership change needs the family-list dependents
// re-evaluated. `created.has(atom) && !deleted.has(atom)` is exact for a root
// index (members = created − deleted); for a scope it can only OVER-report
// "changed" (an inherited-but-not-locally-created member), which is safe — it
// never suppresses a needed propagation.
export const addFamilyAtomsToSet = (
    family: AtomFamily<any, any>,
    familyAtoms: Set<AtomFamilyAtom<any>>,
    data: StoreData,
    timestamp: number,
): boolean => {
    if (familyAtoms.size === 0) return false
    const index = findFamilyIndex(family, data)
    if (!index)
        throw new Error(
            `valdres: family index not found for atomFamily${stateNameSuffix(family)} in store '${data.id}'`,
        )
    let membershipChanged = false
    for (const atom of familyAtoms) {
        // A value-only write must leave the membership index completely alone.
        // Besides preserving insertion order and the rendered-array identity,
        // this avoids copying + sorting all K members on every one of K writes.
        if (hasOwnFamilyAtom(index, atom)) continue
        membershipChanged = true
        index.created.set(atom, timestamp)
        index.deleted.delete(atom)
    }
    if (!membershipChanged) return false
    publishFamilyIndex(family, index, data)
    recursivelyUpdateIndexes(data, family)
    return membershipChanged
}
