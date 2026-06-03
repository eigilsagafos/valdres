import type { Atom } from "../types/Atom"
import type { AtomFamilyAtom } from "../types/AtomFamilyAtom"
import type { StoreData } from "../types/StoreData"
import { equal } from "./equal"
import type { FamilyKey } from "./familyKey"
import type {
    IndexDescriptor,
    IndexHookResult,
} from "./IndexDescriptor"
import { setValueInData, trackScopeValue } from "./setValueInData"
import { stableStringify } from "./stableStringify"

type IndexStorage = {
    bucketsLocal: Map<FamilyKey, Set<AtomFamilyAtom<any>>>
    bucketsRemoved: Map<FamilyKey, Set<AtomFamilyAtom<any>>>
    atomTerms: Map<AtomFamilyAtom<any>, Set<FamilyKey>>
    rendered: Map<FamilyKey, Set<AtomFamilyAtom<any>>>
    parentIndex?: IndexStorage
}

const toTermKeys = (raw: unknown): Set<FamilyKey> => {
    if (raw == null) return new Set()
    if (!Array.isArray(raw)) return new Set()
    if (raw.length === 0) return new Set()
    // Fast path: all-string array (trigrams, prefixes, tokenized words).
    // `new Set(arr)` is implemented natively and beats a manual for-of +
    // Set.add by a wide margin; also skips the per-element typeof check
    // and stableStringify call. stableStringify(string) is a no-op anyway.
    if (typeof raw[0] === "string") {
        return new Set(raw as string[])
    }
    const out = new Set<FamilyKey>()
    for (const t of raw) {
        if (t == null) continue
        out.add(stableStringify(t))
    }
    return out
}

/** Frozen shared empty Set so root-storage lookups for unknown terms
 *  never allocate. Callers only iterate / use `.has` / spread — never
 *  mutate — so a shared singleton is safe. */
const EMPTY_BUCKET: ReadonlySet<AtomFamilyAtom<any>> =
    new Set<AtomFamilyAtom<any>>()

const renderBucket = (
    storage: IndexStorage,
    term: FamilyKey,
): Set<AtomFamilyAtom<any>> => {
    // Root: bucketsLocal IS the rendered bucket (no parent chain to merge,
    // bucketsRemoved is always empty since there's nothing to shadow out).
    // Skip the cache entirely and return the live reference — caller
    // contract is read-only.
    if (!storage.parentIndex) {
        return (storage.bucketsLocal.get(term) ??
            EMPTY_BUCKET) as Set<AtomFamilyAtom<any>>
    }
    const cached = storage.rendered.get(term)
    if (cached) return cached
    // Scope with no local additions/removals for this term: share the
    // parent's Set instead of copying. Parent's Set is either its own
    // bucketsLocal (root) or its own cached render — both treated as
    // immutable by all callers.
    const hasLocalAdd = (storage.bucketsLocal.get(term)?.size ?? 0) > 0
    const hasLocalRemove = (storage.bucketsRemoved.get(term)?.size ?? 0) > 0
    if (!hasLocalAdd && !hasLocalRemove) {
        const parentBucket = renderBucket(storage.parentIndex, term)
        storage.rendered.set(term, parentBucket)
        return parentBucket
    }
    // Scope with local changes: copy parent's bucket and apply diffs.
    const parentBucket = renderBucket(storage.parentIndex, term)
    const result = new Set(parentBucket)
    const removed = storage.bucketsRemoved.get(term)
    if (removed) for (const a of removed) result.delete(a)
    const added = storage.bucketsLocal.get(term)
    if (added) for (const a of added) result.add(a)
    storage.rendered.set(term, result)
    return result
}

const getEffectiveAtomTerms = (
    storage: IndexStorage,
    atom: AtomFamilyAtom<any>,
): Set<FamilyKey> | undefined => {
    if (storage.atomTerms.has(atom)) return storage.atomTerms.get(atom)
    if (storage.parentIndex)
        return getEffectiveAtomTerms(storage.parentIndex, atom)
    return undefined
}

const hasLocalTermState = (
    storage: IndexStorage,
    term: FamilyKey,
): boolean => {
    const added = storage.bucketsLocal.get(term)
    if (added && added.size > 0) return true
    const removed = storage.bucketsRemoved.get(term)
    return !!(removed && removed.size > 0)
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

export const createAtomFamilyIndexDescriptor = <Value, Term>(
    extractor: (value: Value) => readonly Term[] | null | undefined,
    options?: { name?: string },
): {
    descriptor: IndexDescriptor
    getTermAtomByKey: (termKey: FamilyKey) => Atom<AtomFamilyAtom<any>[]>
    releaseTermAtom: (termKey: FamilyKey) => boolean
} => {
    const termAtomCache = new Map<FamilyKey, Atom<AtomFamilyAtom<any>[]>>()
    const indexName = options?.name
    /** Stores that have ever read this descriptor. Used by `release(term)`
     *  to walk live stores and drop dangling references. Held weakly so
     *  short-lived stores can be GC'd; dead refs pruned on next walk. */
    const knownStores = new Set<WeakRef<StoreData>>()

    // eslint-disable-next-line prefer-const
    let descriptor: IndexDescriptor

    /** Drop a termAtom's per-store references — data.values cache, any
     *  dangling subscription/dependent entries. Symmetric with what
     *  `onMount` cleanup does for the subscribed-then-unsubscribed case;
     *  also invoked from `releaseTermAtom` for manual cleanup of
     *  read-only terms (where onMount never fires). */
    const cleanupTermInStore = (
        data: StoreData,
        termAtom: Atom<AtomFamilyAtom<any>[]>,
    ): void => {
        data.values.delete(termAtom)
        data.subscriptions.delete(termAtom)
        data.stateDependents.delete(termAtom)
    }

    const visitLiveStores = (visit: (data: StoreData) => void): void => {
        for (const ref of knownStores) {
            const data = ref.deref()
            if (!data) {
                knownStores.delete(ref)
                continue
            }
            visit(data)
        }
    }

    const getStorage = (data: StoreData): IndexStorage => {
        let storage = data.values.get(descriptor) as IndexStorage | undefined
        if (storage) return storage
        const parentIndex = data.parent
            ? getStorage(data.parent)
            : undefined
        storage = {
            bucketsLocal: new Map(),
            bucketsRemoved: new Map(),
            atomTerms: new Map(),
            rendered: new Map(),
            parentIndex,
        }
        data.values.set(descriptor, storage)
        knownStores.add(new WeakRef(data))
        if (data.parent) {
            trackScopeValue(descriptor, data)
        }
        return storage
    }

    const ensureTermAtom = (
        termKey: FamilyKey,
    ): Atom<AtomFamilyAtom<any>[]> => {
        const cached = termAtomCache.get(termKey)
        if (cached) return cached
        const termAtom: Atom<AtomFamilyAtom<any>[]> = {
            equal,
            defaultValue: () => [],
            name: indexName ? `${indexName}:${termKey}` : undefined,
            onInit: (set, data) => {
                const storage = data.values.get(descriptor) as
                    | IndexStorage
                    | undefined
                if (!storage) return
                const bucket = renderBucket(storage, termKey)
                if (bucket.size > 0) {
                    set([...bucket])
                }
            },
            // Automatic cleanup: when the last subscriber (direct or
            // transitive) detaches from this termAtom, drop its
            // per-store cached value so the termAtom isn't pinned by
            // data.values. The cache entry stays — re-subscribing reuses
            // the same termAtom identity and re-mounts cleanly.
            onMount: (store: unknown) => {
                const data = (store as { data?: StoreData })?.data
                if (!data) return
                return () => cleanupTermInStore(data, termAtom)
            },
        }
        termAtomCache.set(termKey, termAtom)
        return termAtom
    }

    const applyLocalTermChange = (
        storage: IndexStorage,
        term: FamilyKey,
        atom: AtomFamilyAtom<any>,
        kind: "add" | "remove",
    ) => {
        if (kind === "add") {
            let local = storage.bucketsLocal.get(term)
            if (!local) {
                local = new Set()
                storage.bucketsLocal.set(term, local)
            }
            local.add(atom)
            const removed = storage.bucketsRemoved.get(term)
            if (removed) {
                removed.delete(atom)
                if (removed.size === 0) storage.bucketsRemoved.delete(term)
            }
        } else {
            const parentHas =
                storage.parentIndex &&
                renderBucket(storage.parentIndex, term).has(atom)
            if (parentHas) {
                let removed = storage.bucketsRemoved.get(term)
                if (!removed) {
                    removed = new Set()
                    storage.bucketsRemoved.set(term, removed)
                }
                removed.add(atom)
            }
            const local = storage.bucketsLocal.get(term)
            if (local) {
                local.delete(atom)
                if (local.size === 0) storage.bucketsLocal.delete(term)
            }
        }
        storage.rendered.delete(term)
    }

    /** Write source-scope termAtom value.
     *
     *  At root storage: only materializes when the term atom has already
     *  been created (i.e. someone has queried this term). Otherwise
     *  storage stays up to date and a future first read materializes
     *  lazily via the term atom's `onInit`. This is the dominant
     *  optimization for bulk inserts — O(N) array spreads on every write
     *  for terms nobody is reading collapse to O(0).
     *
     *  At scope storage: eagerly creates and writes the term atom. Scope
     *  writes need to populate the scope's `data.values` so that reads
     *  in this scope (or its descendants) see the scope-local override
     *  instead of walking up to the parent's stale view. */
    const writeForSource = (
        storage: IndexStorage,
        term: FamilyKey,
        sourceData: StoreData,
        accum: IndexHookResult,
    ) => {
        let termAtom = termAtomCache.get(term)
        if (!termAtom) {
            if (!storage.parentIndex) return // root: skip
            termAtom = ensureTermAtom(term) // scope: eagerly create
        }
        const newArray = [...renderBucket(storage, term)]
        setValueInData(termAtom as Atom<unknown>, newArray, sourceData)
        if (!accum.local) accum.local = new Set()
        accum.local.add(termAtom)
    }

    /**
     * Maybe write a descendant scope's termAtom value during cross-scope
     * propagation. Skips when:
     *   - the term has never been queried (no termAtom in cache), so no
     *     subscribers/dependents care
     *   - the scope has no local state AND hasn't read this termAtom; in
     *     that case reads will walk the parent chain naturally and the
     *     parent already has the up-to-date value
     *
     * When we do write, equality-check first to skip subscriber-fire when
     * the effective bucket is unchanged in this scope.
     */
    const maybeWriteForDescendant = (
        storage: IndexStorage,
        term: FamilyKey,
        scopeData: StoreData,
        accum: IndexHookResult,
    ) => {
        const termAtom = termAtomCache.get(term)
        if (!termAtom) {
            storage.rendered.delete(term)
            return
        }
        const hasLocal = hasLocalTermState(storage, term)
        const wasRead = scopeData.values.has(termAtom)
        if (!hasLocal && !wasRead) {
            storage.rendered.delete(term)
            return
        }
        storage.rendered.delete(term)
        const newArray = [...renderBucket(storage, term)]
        if (wasRead) {
            const oldValue = scopeData.values.get(termAtom)
            if (termAtom.equal(oldValue, newArray)) return
        }
        setValueInData(termAtom as Atom<unknown>, newArray, scopeData)
        addToCross(accum, scopeData, termAtom)
    }

    /**
     * After source-scope storage has been mutated, walk descendant scopes
     * via `scopeValueIndex` and let each one re-render the affected terms.
     * Recursion only descends into scopes that have storage for this
     * descriptor — pass-through scopes are skipped (their reads walk the
     * parent chain).
     */
    const propagateToDescendants = (
        data: StoreData,
        changedTerms: Iterable<FamilyKey>,
        accum: IndexHookResult,
    ) => {
        const descendants = data.scopeValueIndex.get(descriptor)
        if (!descendants || descendants.size === 0) return
        for (const scopeData of descendants) {
            const scopeStorage = scopeData.values.get(descriptor) as
                | IndexStorage
                | undefined
            if (!scopeStorage) continue
            for (const t of changedTerms) {
                maybeWriteForDescendant(scopeStorage, t, scopeData, accum)
            }
            propagateToDescendants(scopeData, changedTerms, accum)
        }
    }

    /**
     * On delete, an atom may live in bucketsRemoved entries in descendant
     * scopes (parent had it in bucket X, scope shadowed it out of X). Strong
     * references in those Sets would prevent GC of the deleted atom. Walk
     * all scopes that have storage for this descriptor — starting from the
     * root — and drop the atom from every `bucketsRemoved` set.
     *
     * This is the cleanup half of #5 in the staff review: prevents the
     * silent leak after `store.del`.
     */
    const cleanupDescendantBucketsRemoved = (
        rootData: StoreData,
        atom: AtomFamilyAtom<any>,
    ) => {
        const visit = (data: StoreData) => {
            const storage = data.values.get(descriptor) as
                | IndexStorage
                | undefined
            if (storage) {
                for (const [term, removedSet] of storage.bucketsRemoved) {
                    if (removedSet.delete(atom)) {
                        if (removedSet.size === 0)
                            storage.bucketsRemoved.delete(term)
                        storage.rendered.delete(term)
                    }
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
            const newTerms = toTermKeys(extractor(data.values.get(atom)))
            const oldTerms = getEffectiveAtomTerms(storage, atom)

            // Hot path for bulk inserts: new atom at root storage. Skips
            // diff loop, descendant propagation walk, and the per-term
            // `applyLocalTermChange` indirection (no bucketsRemoved /
            // rendered.delete to maintain at root — bucketsLocal IS the
            // canonical bucket).
            if (
                oldTerms === undefined &&
                storage.parentIndex === undefined &&
                termAtomCache.size === 0
            ) {
                if (newTerms.size > 0) {
                    const bucketsLocal = storage.bucketsLocal
                    for (const t of newTerms) {
                        let local = bucketsLocal.get(t)
                        if (local === undefined) {
                            local = new Set()
                            bucketsLocal.set(t, local)
                        }
                        local.add(atom)
                    }
                    storage.atomTerms.set(atom, newTerms)
                }
                return
            }

            const changedTerms: FamilyKey[] = []

            if (oldTerms) {
                for (const t of oldTerms) {
                    if (newTerms.has(t)) continue
                    applyLocalTermChange(storage, t, atom, "remove")
                    writeForSource(storage, t, data, accum)
                    changedTerms.push(t)
                }
            }
            for (const t of newTerms) {
                if (oldTerms?.has(t)) continue
                applyLocalTermChange(storage, t, atom, "add")
                writeForSource(storage, t, data, accum)
                changedTerms.push(t)
            }

            if (newTerms.size === 0) {
                if (
                    oldTerms &&
                    oldTerms.size > 0 &&
                    !storage.atomTerms.has(atom)
                ) {
                    // oldTerms inherited from parent; record empty local
                    // entry so future diffs in this scope use ∅ as baseline.
                    storage.atomTerms.set(atom, new Set())
                } else {
                    storage.atomTerms.delete(atom)
                }
            } else {
                storage.atomTerms.set(atom, newTerms)
            }

            if (changedTerms.length > 0) {
                propagateToDescendants(data, changedTerms, accum)
            }
        },
        onDelete: (_family, atom, data, accum) => {
            // Always init storage on delete: a scope-level del needs to
            // shadow the parent's bucket out, even if the scope hasn't
            // written before. Symmetrical with onWrite which also inits.
            const storage = getStorage(data)
            const oldTerms = getEffectiveAtomTerms(storage, atom)

            const changedTerms: FamilyKey[] = []
            if (oldTerms && oldTerms.size > 0) {
                for (const t of oldTerms) {
                    applyLocalTermChange(storage, t, atom, "remove")
                    writeForSource(storage, t, data, accum)
                    changedTerms.push(t)
                }
            }
            storage.atomTerms.delete(atom)

            if (changedTerms.length > 0) {
                propagateToDescendants(data, changedTerms, accum)
            }

            // Root-level delete is the only place where we know the atom is
            // being removed from the family canonically and not just
            // scope-shadowed; only then do we drop descendant
            // `bucketsRemoved` entries so the orphaned atom can be GC'd.
            // For scope-level del, the atom remains in parent storage and
            // the scope's own bucketsRemoved entry was just added on
            // purpose — must not be undone here.
            if (!data.parent) {
                cleanupDescendantBucketsRemoved(data, atom)
            }
        },
    }

    return {
        descriptor,
        getTermAtomByKey: ensureTermAtom,
        /** Drop a term's cached atom and clear its data.values /
         *  subscription / dependent entries from every live store that
         *  has touched this descriptor. Use for read-only terms where
         *  `onMount` cleanup never fires (the user `get`-but-never-`sub`s).
         *  Returns true if a cache entry existed. */
        releaseTermAtom: (termKey: FamilyKey): boolean => {
            const termAtom = termAtomCache.get(termKey)
            if (!termAtom) return false
            termAtomCache.delete(termKey)
            visitLiveStores(data => cleanupTermInStore(data, termAtom))
            return true
        },
    }
}
