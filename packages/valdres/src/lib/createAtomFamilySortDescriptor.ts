import type { Atom } from "../types/Atom"
import type { AtomFamilyAtom } from "../types/AtomFamilyAtom"
import type { StoreData } from "../types/StoreData"
import { equal } from "./equal"
import type {
    IndexDescriptor,
    IndexHookResult,
} from "./IndexDescriptor"
import { setValueInData, trackScopeValue } from "./setValueInData"

type SortStorage = {
    /** Atoms with an explicit local sort key in this scope. Overrides any
     *  inherited key from the parent chain. */
    localKeys: Map<AtomFamilyAtom<any>, unknown>
    /** Atoms that the parent chain considers part of the view but this
     *  scope shadows out (extractor returned null/undefined or the atom
     *  was deleted in this scope). */
    removedFromParent: Set<AtomFamilyAtom<any>>
    /** Sorted view of effective atoms.
     *  - At root: maintained incrementally via binary-search insert/remove
     *    on every write. Always defined post-construction.
     *  - At scope: lazy — rebuilt from parent + local diffs on demand;
     *    invalidated to null when local state changes or parent propagates. */
    rendered: AtomFamilyAtom<any>[] | null
    parentIndex?: SortStorage
}

const buildEffectiveKeys = (
    storage: SortStorage,
): Map<AtomFamilyAtom<any>, unknown> => {
    const result = storage.parentIndex
        ? new Map(buildEffectiveKeys(storage.parentIndex))
        : new Map<AtomFamilyAtom<any>, unknown>()
    for (const [atom, key] of storage.localKeys) {
        result.set(atom, key)
    }
    for (const atom of storage.removedFromParent) {
        result.delete(atom)
    }
    return result
}

const getEffectiveKey = (
    storage: SortStorage,
    atom: AtomFamilyAtom<any>,
): unknown => {
    if (storage.removedFromParent.has(atom)) return undefined
    if (storage.localKeys.has(atom)) return storage.localKeys.get(atom)
    if (storage.parentIndex) return getEffectiveKey(storage.parentIndex, atom)
    return undefined
}

const compareKeys = (
    aKey: any,
    bKey: any,
    a: AtomFamilyAtom<any>,
    b: AtomFamilyAtom<any>,
    direction: "asc" | "desc",
): number => {
    // Direction applies only to the key comparison. The tiebreak by
    // `familyArgsStringified` is ALWAYS ascending so equal-key subsets
    // are stable across renders AND across asc/desc — users sorting
    // `desc` by date and expecting `[id-a, id-b]` for two same-date
    // items shouldn't see `[id-b, id-a]`.
    if (aKey < bKey) return direction === "desc" ? 1 : -1
    if (aKey > bKey) return direction === "desc" ? -1 : 1
    const sa = String(a.familyArgsStringified)
    const sb = String(b.familyArgsStringified)
    return sa < sb ? -1 : sa > sb ? 1 : 0
}

/** Binary-search the position where `atom` (with `atomKey`) should be
 *  inserted to maintain sort order. `getKey` returns the existing array
 *  members' keys. Returns the index where `arr.splice(pos, 0, atom)`
 *  preserves the sort. */
const findInsertPos = (
    arr: AtomFamilyAtom<any>[],
    atom: AtomFamilyAtom<any>,
    atomKey: unknown,
    getKey: (a: AtomFamilyAtom<any>) => unknown,
    direction: "asc" | "desc",
): number => {
    let lo = 0
    let hi = arr.length
    while (lo < hi) {
        const mid = (lo + hi) >>> 1
        const other = arr[mid]
        const cmp = compareKeys(atomKey, getKey(other), atom, other, direction)
        if (cmp < 0) hi = mid
        else lo = mid + 1
    }
    return lo
}

/** Binary-search for the exact position of `atom` in `arr` using the
 *  comparator (which is a total order over distinct atoms thanks to the
 *  familyArgsStringified tiebreak). Returns -1 if not found. */
const findExactPos = (
    arr: AtomFamilyAtom<any>[],
    atom: AtomFamilyAtom<any>,
    atomKey: unknown,
    getKey: (a: AtomFamilyAtom<any>) => unknown,
    direction: "asc" | "desc",
): number => {
    let lo = 0
    let hi = arr.length
    while (lo < hi) {
        const mid = (lo + hi) >>> 1
        const other = arr[mid]
        const cmp = compareKeys(atomKey, getKey(other), atom, other, direction)
        if (cmp === 0) return mid
        if (cmp < 0) hi = mid
        else lo = mid + 1
    }
    return -1
}

const renderSorted = (
    storage: SortStorage,
    direction: "asc" | "desc",
): AtomFamilyAtom<any>[] => {
    if (storage.rendered) return storage.rendered
    // Lazy rebuild — used by scope storage after invalidation.
    const effective = buildEffectiveKeys(storage)
    const sorted = [...effective.keys()].sort((a, b) =>
        compareKeys(effective.get(a), effective.get(b), a, b, direction),
    )
    storage.rendered = sorted
    return sorted
}

const addToCross = (
    accum: IndexHookResult,
    scopeData: StoreData,
    atom: Atom<any>,
) => {
    if (!accum.cross) accum.cross = new Map()
    let set = accum.cross.get(scopeData)
    if (!set) {
        set = new Set()
        accum.cross.set(scopeData, set)
    }
    set.add(atom)
}

export const createAtomFamilySortDescriptor = <Value, Key>(
    extractor: (value: Value) => Key | null | undefined,
    options: { direction?: "asc" | "desc"; name?: string } = {},
): {
    descriptor: IndexDescriptor
    resultAtom: Atom<AtomFamilyAtom<any>[]>
} => {
    const direction = options.direction ?? "asc"
    const sortName = options.name

    // eslint-disable-next-line prefer-const
    let descriptor: IndexDescriptor

    const getStorage = (data: StoreData): SortStorage => {
        let storage = data.values.get(descriptor) as SortStorage | undefined
        if (storage) return storage
        const parentIndex = data.parent
            ? getStorage(data.parent)
            : undefined
        storage = {
            localKeys: new Map(),
            removedFromParent: new Set(),
            // Root: start with empty sorted array (always maintained).
            // Scope: null — built lazily on first render.
            rendered: parentIndex ? null : [],
            parentIndex,
        }
        data.values.set(descriptor, storage)
        if (data.parent) {
            trackScopeValue(descriptor, data)
        }
        return storage
    }

    const resultAtom: Atom<AtomFamilyAtom<any>[]> = {
        equal,
        defaultValue: () => [],
        name: sortName,
        onInit: (set, data) => {
            const storage = data.values.get(descriptor) as
                | SortStorage
                | undefined
            if (!storage) return
            const sorted = renderSorted(storage, direction)
            if (sorted.length > 0) set([...sorted])
        },
        // Symmetric with atomFamilyIndex: last-subscriber cleanup drops
        // the per-store cached array so the resultAtom isn't kept alive
        // by data.values once nobody's listening.
        //
        // We deliberately do NOT delete the SortStorage (data.values.get
        // (descriptor)) here. That is *index state* — the accumulated
        // localKeys / removedFromParent built incrementally by onWrite —
        // not a rebuildable cache. Dropping it on unmount would lose the
        // sort and rebuild empty on re-subscribe (the members were already
        // written; onWrite won't replay). It's one object per descriptor
        // per store (O(1), not a growing leak) and is reclaimed when the
        // store's data or the descriptor itself is GC'd.
        onMount: (store: unknown) => {
            const data = (store as { data?: StoreData })?.data
            if (!data) return
            return () => {
                data.values.delete(resultAtom)
                data.subscriptions.delete(resultAtom)
                data.stateDependents.delete(resultAtom)
            }
        },
    }

    /** Apply a key change at the root storage incrementally. Caller passes
     *  the OLD effective key (for finding the existing position) and the
     *  NEW key. Either may be null/undefined for insertion/removal cases.
     *  Mutates `storage.rendered` and `storage.localKeys` to reflect the
     *  new state.
     *
     *  Cost: **O(N) per write**. Binary search locates the old/new
     *  positions in O(log N), but `splice` is O(N) because of the array
     *  shift. A true O(log N) maintained sort would require an order-
     *  statistics tree or skip list — not worth the implementation cost
     *  for typical sort-view sizes (where N is small relative to write
     *  volume, or writes are bursty inside transactions and the
     *  amortized cost is fine). Pre-this-PR there was no incremental
     *  path at all: every write triggered a full O(N log N) re-sort. */
    const applyRootIncremental = (
        storage: SortStorage,
        atom: AtomFamilyAtom<any>,
        oldKey: unknown,
        newKey: unknown,
    ) => {
        const sortedArr = storage.rendered as AtomFamilyAtom<any>[]
        const getKey = (a: AtomFamilyAtom<any>) => storage.localKeys.get(a)

        const oldValid = oldKey !== null && oldKey !== undefined
        const newValid = newKey !== null && newKey !== undefined

        if (oldValid) {
            const pos = findExactPos(
                sortedArr,
                atom,
                oldKey,
                getKey,
                direction,
            )
            if (pos !== -1) sortedArr.splice(pos, 1)
        }

        // Update localKeys to the NEW state before computing insert position
        // so getKey reflects the post-write state.
        if (newValid) {
            storage.localKeys.set(atom, newKey)
        } else {
            storage.localKeys.delete(atom)
        }

        if (newValid) {
            const pos = findInsertPos(
                sortedArr,
                atom,
                newKey,
                getKey,
                direction,
            )
            sortedArr.splice(pos, 0, atom)
        }
    }

    /** Apply a key change at a scoped storage. Caller passes new key; the
     *  scope's local state is updated and `rendered` is invalidated for
     *  lazy rebuild on next read. */
    const applyScopeChange = (
        storage: SortStorage,
        atom: AtomFamilyAtom<any>,
        newKey: unknown,
    ) => {
        const newValid = newKey !== null && newKey !== undefined
        if (newValid) {
            storage.localKeys.set(atom, newKey)
            storage.removedFromParent.delete(atom)
        } else {
            storage.localKeys.delete(atom)
            const parentHas =
                storage.parentIndex &&
                getEffectiveKey(storage.parentIndex, atom) !== undefined
            if (parentHas) {
                storage.removedFromParent.add(atom)
            }
        }
        storage.rendered = null
    }

    const writeResultAtomValue = (
        storage: SortStorage,
        data: StoreData,
        accum: IndexHookResult,
    ) => {
        const sorted = renderSorted(storage, direction)
        setValueInData(resultAtom as Atom<unknown>, [...sorted], data)
        if (!accum.local) accum.local = new Set()
        accum.local.add(resultAtom)
    }

    const propagateToDescendants = (
        data: StoreData,
        accum: IndexHookResult,
    ) => {
        const descendants = data.scopeValueIndex.get(descriptor)
        if (!descendants || descendants.size === 0) return
        for (const scopeData of descendants) {
            const scopeStorage = scopeData.values.get(descriptor) as
                | SortStorage
                | undefined
            if (!scopeStorage) continue
            scopeStorage.rendered = null
            const hasLocal =
                scopeStorage.localKeys.size > 0 ||
                scopeStorage.removedFromParent.size > 0
            const wasRead = scopeData.values.has(resultAtom)
            if (hasLocal || wasRead) {
                const sorted = renderSorted(scopeStorage, direction)
                const newArray = [...sorted]
                if (wasRead) {
                    const oldValue = scopeData.values.get(resultAtom)
                    if (resultAtom.equal(oldValue, newArray)) {
                        propagateToDescendants(scopeData, accum)
                        continue
                    }
                }
                setValueInData(
                    resultAtom as Atom<unknown>,
                    newArray,
                    scopeData,
                )
                addToCross(accum, scopeData, resultAtom)
            }
            propagateToDescendants(scopeData, accum)
        }
    }

    const cleanupDescendantStorage = (
        rootData: StoreData,
        atom: AtomFamilyAtom<any>,
    ) => {
        const visit = (data: StoreData) => {
            const storage = data.values.get(descriptor) as
                | SortStorage
                | undefined
            if (storage) {
                if (storage.removedFromParent.delete(atom)) {
                    storage.rendered = null
                }
            }
            const children = data.scopeValueIndex.get(descriptor)
            if (children) for (const c of children) visit(c)
        }
        visit(rootData)
    }

    descriptor = {
        onWrite: (_family, atom, data, accum) => {
            const storage = getStorage(data)
            const newValue = data.values.get(atom)
            const newKey =
                newValue == null
                    ? null
                    : (extractor(newValue as Value) ?? null)
            const oldEffectiveKey = getEffectiveKey(storage, atom)
            const newKeyValid = newKey !== null && newKey !== undefined
            const oldKeyValid =
                oldEffectiveKey !== null && oldEffectiveKey !== undefined

            // No-op: key unchanged
            if (newKeyValid && oldKeyValid && newKey === oldEffectiveKey) return
            // No-op: both excluded
            if (!newKeyValid && !oldKeyValid) {
                if (storage.localKeys.has(atom)) storage.localKeys.delete(atom)
                return
            }

            if (!storage.parentIndex) {
                // Root: incremental update via binary search
                applyRootIncremental(storage, atom, oldEffectiveKey, newKey)
            } else {
                applyScopeChange(storage, atom, newKey)
            }

            writeResultAtomValue(storage, data, accum)
            propagateToDescendants(data, accum)
        },
        onDelete: (_family, atom, data, accum) => {
            const storage = getStorage(data)
            const oldEffectiveKey = getEffectiveKey(storage, atom)
            if (oldEffectiveKey === undefined) {
                if (storage.localKeys.has(atom)) storage.localKeys.delete(atom)
                return
            }

            if (!storage.parentIndex) {
                // Root: incremental remove
                applyRootIncremental(
                    storage,
                    atom,
                    oldEffectiveKey,
                    null,
                )
            } else {
                applyScopeChange(storage, atom, null)
            }

            writeResultAtomValue(storage, data, accum)
            propagateToDescendants(data, accum)

            // Root-level delete: drop any lingering removedFromParent
            // entries pointing at this atom so it can be GC'd. (Symmetric
            // to the cleanup in createAtomFamilyIndexDescriptor.)
            if (!data.parent) {
                cleanupDescendantStorage(data, atom)
            }
        },
    }

    return { descriptor, resultAtom }
}
