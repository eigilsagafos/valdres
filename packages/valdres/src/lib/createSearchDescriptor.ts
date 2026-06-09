import type { Atom } from "../types/Atom"
import type { AtomFamilyAtom } from "../types/AtomFamilyAtom"
import type { StoreData } from "../types/StoreData"
import { equal } from "./equal"
import type { IndexDescriptor, IndexHookResult } from "./IndexDescriptor"
import { setValueInData, trackScopeValue } from "./setValueInData"

/**
 * The unified search index descriptor (#6 in dev/search-engine-v2.md).
 *
 * Replaces the two-descriptor design (a generic `atomFamilyIndex` for the
 * inverted buckets + a separate BM25-stats descriptor) with ONE descriptor
 * that maintains, in a single write pass over a single per-atom record:
 *
 *   - inverted buckets (term → atoms) + reactive term atoms (the query
 *     subscription surface), scope-aware with lazy root materialization,
 *     cross-scope propagation, and tombstone cleanup — ported faithfully
 *     from `createAtomFamilyIndexDescriptor`;
 *   - per-(atom, field) BM25 stats (termCounts, length, positions) and
 *     per-field totals (for avgdl) — folded in here.
 *
 * The spike (dev/search-engine-v2.md) measured ~34% faster insertion vs the
 * two-descriptor design; the win is from collapsing two passes / two per-atom
 * records into one. The `extract` fn returns the SAME field-stats shape
 * atomFamilySearch already computes, so the bucket terms are just the union
 * of each field's termCounts keys.
 *
 * NOTE: standalone + unit-tested here against a brute-force compare; wiring it
 * into atomFamilySearch is the next gated step (run the differential fuzzer
 * against both index backends, including subscription fire-counts).
 */
export type FieldStats = {
    length: number
    termCounts: Map<string, number>
    positions?: Map<string, number[]>
}

/** Per-scope storage. `parent` is the parent scope's storage (undefined at
 *  root). Buckets render by merging the parent chain (local adds + removals
 *  shadowing inherited members); stats read by walking the chain. */
type SearchStorage = {
    bucketsLocal: Map<string, Set<AtomFamilyAtom<any>>>
    bucketsRemoved: Map<string, Set<AtomFamilyAtom<any>>>
    rendered: Map<string, Set<AtomFamilyAtom<any>>>
    /** Per-atom field stats — the SINGLE per-atom record. Its termCounts keys
     *  are the atom's terms (replaces the old separate `atomTerms`). */
    perAtom: Map<AtomFamilyAtom<any>, Map<string, FieldStats>>
    fieldTotals: Map<string, { totalLength: number; docCount: number }>
    /** Bumped every write; the value carried by `statsAtom` so the scoring
     *  selector re-evaluates when stats change without bucket membership
     *  changing (e.g. a rewrite that only changes term frequency). */
    epoch: number
    parent?: SearchStorage
}

export type SearchVocabHooks = {
    /** A distinct term entered the vocabulary (refcount 0→1, summed over the
     *  whole instance). For maintaining a trie / BK-tree / suggest vocab. */
    onTermAdded?: (term: string) => void
    /** A distinct term left the vocabulary (refcount →0). */
    onTermRemoved?: (term: string) => void
}

const EMPTY_BUCKET: ReadonlySet<AtomFamilyAtom<any>> = new Set()

const unionTerms = (
    fields: Map<string, FieldStats> | undefined,
): Set<string> => {
    const out = new Set<string>()
    if (!fields) return out
    for (const fs of fields.values())
        for (const t of fs.termCounts.keys()) out.add(t)
    return out
}

export const createSearchDescriptor = <Value>(
    extract: (value: Value) => Map<string, FieldStats>,
    options?: { name?: string; vocab?: SearchVocabHooks },
) => {
    const termAtomCache = new Map<string, Atom<AtomFamilyAtom<any>[]>>()
    const indexName = options?.name
    const vocab = options?.vocab
    const knownStores = new Set<WeakRef<StoreData>>()

    // eslint-disable-next-line prefer-const
    let descriptor: IndexDescriptor

    /** Instance-wide term refcounts (occurrence totals across all atoms),
     *  maintained only when a vocabulary is tracked (prefix mode / tolerance —
     *  signalled by passing `vocab`). Doubles as the wrapper's term dictionary
     *  (keys = vocabulary, value = document/occurrence frequency) and fires
     *  the vocab hooks on the 0↔1 distinct-term edges. */
    const termRefs = new Map<string, number>()
    const incRef = (term: string, n: number) => {
        if (!vocab) return
        const prev = termRefs.get(term) ?? 0
        termRefs.set(term, prev + n)
        if (prev === 0 && n > 0) vocab.onTermAdded?.(term)
    }
    const decRef = (term: string, n: number) => {
        if (!vocab) return
        const next = (termRefs.get(term) ?? 0) - n
        if (next <= 0) {
            termRefs.delete(term)
            vocab.onTermRemoved?.(term)
        } else {
            termRefs.set(term, next)
        }
    }

    /** Per-instance stats signal. Value is the (mutable) per-scope storage;
     *  `equal` compares `epoch` so the in-place mutation reads as a change. */
    const statsAtom: Atom<SearchStorage> = {
        equal: (a, b) => a.epoch === b.epoch,
        defaultValue: () => mkStorage(undefined),
        name: indexName ? `${indexName}:stats` : undefined,
        mutable: true,
    }

    const mkStorage = (parent: SearchStorage | undefined): SearchStorage => ({
        bucketsLocal: new Map(),
        bucketsRemoved: new Map(),
        rendered: new Map(),
        perAtom: new Map(),
        fieldTotals: new Map(),
        epoch: 0,
        parent,
    })

    const getStorage = (data: StoreData): SearchStorage => {
        let storage = data.values.get(descriptor) as SearchStorage | undefined
        if (storage) return storage
        const parent = data.parent ? getStorage(data.parent) : undefined
        storage = mkStorage(parent)
        data.values.set(descriptor, storage)
        // Mirror the stats signal into this scope so reads in-scope see it.
        data.values.set(statsAtom, storage)
        knownStores.add(new WeakRef(data))
        if (data.parent) {
            trackScopeValue(descriptor, data)
            trackScopeValue(statsAtom, data)
        }
        return storage
    }

    const renderBucket = (
        storage: SearchStorage,
        term: string,
    ): Set<AtomFamilyAtom<any>> => {
        if (!storage.parent) {
            return (storage.bucketsLocal.get(term) ??
                EMPTY_BUCKET) as Set<AtomFamilyAtom<any>>
        }
        const cached = storage.rendered.get(term)
        if (cached) return cached
        const hasAdd = (storage.bucketsLocal.get(term)?.size ?? 0) > 0
        const hasRemove = (storage.bucketsRemoved.get(term)?.size ?? 0) > 0
        if (!hasAdd && !hasRemove) {
            const parentBucket = renderBucket(storage.parent, term)
            storage.rendered.set(term, parentBucket)
            return parentBucket
        }
        const result = new Set(renderBucket(storage.parent, term))
        const removed = storage.bucketsRemoved.get(term)
        if (removed) for (const a of removed) result.delete(a)
        const added = storage.bucketsLocal.get(term)
        if (added) for (const a of added) result.add(a)
        storage.rendered.set(term, result)
        return result
    }

    const getEffectiveFields = (
        storage: SearchStorage,
        atom: AtomFamilyAtom<any>,
    ): Map<string, FieldStats> | undefined => {
        let s: SearchStorage | undefined = storage
        while (s) {
            const f = s.perAtom.get(atom)
            if (f) return f
            s = s.parent
        }
        return undefined
    }

    const applyLocalTermChange = (
        storage: SearchStorage,
        term: string,
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
                storage.parent && renderBucket(storage.parent, term).has(atom)
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

    const ensureTermAtom = (term: string): Atom<AtomFamilyAtom<any>[]> => {
        const cached = termAtomCache.get(term)
        if (cached) return cached
        const termAtom: Atom<AtomFamilyAtom<any>[]> = {
            equal,
            defaultValue: () => [],
            name: indexName ? `${indexName}:${term}` : undefined,
            onInit: (set, data) => {
                const storage = data.values.get(descriptor) as
                    | SearchStorage
                    | undefined
                if (!storage) return
                const bucket = renderBucket(storage, term)
                if (bucket.size > 0) set([...bucket])
            },
            onMount: (storeLike: unknown) => {
                const data = (storeLike as { data?: StoreData })?.data
                if (!data) return
                return () => {
                    data.values.delete(termAtom)
                    data.subscriptions.delete(termAtom)
                    data.stateDependents.delete(termAtom)
                }
            },
        }
        termAtomCache.set(term, termAtom)
        return termAtom
    }

    const writeForSource = (
        storage: SearchStorage,
        term: string,
        sourceData: StoreData,
        accum: IndexHookResult,
    ) => {
        let termAtom = termAtomCache.get(term)
        if (!termAtom) {
            if (!storage.parent) return // root: lazy — skip until queried
            termAtom = ensureTermAtom(term)
        }
        setValueInData(
            termAtom as Atom<unknown>,
            [...renderBucket(storage, term)],
            sourceData,
        )
        if (!accum.local) accum.local = new Set()
        accum.local.add(termAtom)
    }

    const hasLocalTermState = (
        storage: SearchStorage,
        term: string,
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

    const maybeWriteForDescendant = (
        storage: SearchStorage,
        term: string,
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

    const propagateToDescendants = (
        data: StoreData,
        changedTerms: Iterable<string>,
        accum: IndexHookResult,
    ) => {
        const descendants = data.scopeValueIndex.get(descriptor)
        if (!descendants || descendants.size === 0) return
        for (const scopeData of descendants) {
            const scopeStorage = scopeData.values.get(descriptor) as
                | SearchStorage
                | undefined
            if (!scopeStorage) continue
            for (const t of changedTerms)
                maybeWriteForDescendant(scopeStorage, t, scopeData, accum)
            propagateToDescendants(scopeData, changedTerms, accum)
        }
    }

    const cleanupDescendantBucketsRemoved = (
        rootData: StoreData,
        atom: AtomFamilyAtom<any>,
    ) => {
        const visit = (data: StoreData) => {
            const storage = data.values.get(descriptor) as
                | SearchStorage
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

    /** Subtract one atom's LOCAL field stats from this scope's `fieldTotals`
     *  and the instance vocab refcounts. Returns the old terms (for the bucket
     *  diff). Mirrors the old detachAtomStats, scoped. */
    const detachLocalStats = (
        storage: SearchStorage,
        atom: AtomFamilyAtom<any>,
    ): void => {
        const stats = storage.perAtom.get(atom)
        if (!stats) return
        for (const [field, fs] of stats) {
            for (const [term, count] of fs.termCounts) decRef(term, count)
            const tot = storage.fieldTotals.get(field)
            if (!tot) continue
            tot.totalLength -= fs.length
            tot.docCount -= 1
            if (tot.docCount <= 0) storage.fieldTotals.delete(field)
        }
    }

    const bump = (
        storage: SearchStorage,
        data: StoreData,
        accum: IndexHookResult,
    ) => {
        storage.epoch++
        setValueInData(statsAtom, storage, data)
        if (!accum.local) accum.local = new Set()
        accum.local.add(statsAtom)
    }

    descriptor = {
        onWrite: (_family, atom, data, accum) => {
            const storage = getStorage(data)
            const newFields = extract(data.values.get(atom) as Value)
            const newTerms = unionTerms(newFields)
            const oldFields = getEffectiveFields(storage, atom)
            const oldTerms = unionTerms(oldFields)

            // Hot path: brand-new atom at root, nothing queried yet.
            if (
                oldFields === undefined &&
                storage.parent === undefined &&
                termAtomCache.size === 0
            ) {
                if (newFields.size > 0) {
                    for (const t of newTerms) {
                        let local = storage.bucketsLocal.get(t)
                        if (!local) {
                            local = new Set()
                            storage.bucketsLocal.set(t, local)
                        }
                        local.add(atom)
                    }
                    attachStats(storage, atom, newFields)
                }
                bump(storage, data, accum)
                return
            }

            // Tear down old LOCAL stats (vocab + fieldTotals) before reattach.
            detachLocalStats(storage, atom)

            const changedTerms: string[] = []
            for (const t of oldTerms) {
                if (newTerms.has(t)) continue
                applyLocalTermChange(storage, t, atom, "remove")
                writeForSource(storage, t, data, accum)
                changedTerms.push(t)
            }
            for (const t of newTerms) {
                if (oldTerms.has(t)) continue
                applyLocalTermChange(storage, t, atom, "add")
                writeForSource(storage, t, data, accum)
                changedTerms.push(t)
            }

            if (newFields.size === 0) {
                if (oldFields && !storage.perAtom.has(atom)) {
                    storage.perAtom.set(atom, new Map()) // empty local baseline
                } else {
                    storage.perAtom.delete(atom)
                }
            } else {
                attachStats(storage, atom, newFields)
            }

            if (changedTerms.length > 0)
                propagateToDescendants(data, changedTerms, accum)
            bump(storage, data, accum)
        },
        onDelete: (_family, atom, data, accum) => {
            const storage = getStorage(data)
            const oldFields = getEffectiveFields(storage, atom)
            const oldTerms = unionTerms(oldFields)
            detachLocalStats(storage, atom)

            const changedTerms: string[] = []
            for (const t of oldTerms) {
                applyLocalTermChange(storage, t, atom, "remove")
                writeForSource(storage, t, data, accum)
                changedTerms.push(t)
            }
            storage.perAtom.delete(atom)

            if (changedTerms.length > 0)
                propagateToDescendants(data, changedTerms, accum)
            if (!data.parent) cleanupDescendantBucketsRemoved(data, atom)
            bump(storage, data, accum)
        },
    }

    /** Attach a fresh per-atom stats record + fold its terms into fieldTotals
     *  and the vocab refcounts. */
    function attachStats(
        storage: SearchStorage,
        atom: AtomFamilyAtom<any>,
        fields: Map<string, FieldStats>,
    ) {
        storage.perAtom.set(atom, fields)
        for (const [field, fs] of fields) {
            for (const [term, count] of fs.termCounts) incRef(term, count)
            let tot = storage.fieldTotals.get(field)
            if (!tot) {
                tot = { totalLength: 0, docCount: 0 }
                storage.fieldTotals.set(field, tot)
            }
            tot.totalLength += fs.length
            tot.docCount += 1
        }
    }

    return {
        descriptor,
        statsAtom,
        termAtom: ensureTermAtom,
        renderBucket,
        /** Occurrence-refcounted vocabulary (term → frequency), populated only
         *  when `vocab` hooks are passed. The wrapper uses it for the prefix
         *  scan, `suggest` ranking, and `__dictionarySize`. */
        termRefs,
        /** Per-(atom) field stats, walking the scope chain (closest wins). */
        getFieldStats: getEffectiveFields,
        /** Sum field totals across the chain (approximate under shadowing, as
         *  the legacy design also was). */
        getFieldTotal: (
            storage: SearchStorage,
            field: string,
        ): { totalLength: number; docCount: number } => {
            let totalLength = 0
            let docCount = 0
            let s: SearchStorage | undefined = storage
            while (s) {
                const t = s.fieldTotals.get(field)
                if (t) {
                    totalLength += t.totalLength
                    docCount += t.docCount
                }
                s = s.parent
            }
            return { totalLength, docCount }
        },
        collectFieldNames: (storage: SearchStorage): Set<string> => {
            const out = new Set<string>()
            let s: SearchStorage | undefined = storage
            while (s) {
                for (const f of s.fieldTotals.keys()) out.add(f)
                s = s.parent
            }
            return out
        },
        /** Distinct indexed atoms across the scope chain (a doc may populate
         *  only some fields, so not just the max per-field count). */
        documentCount: (storage: SearchStorage): number => {
            const seen = new Set<AtomFamilyAtom<any>>()
            let s: SearchStorage | undefined = storage
            while (s) {
                for (const atom of s.perAtom.keys()) seen.add(atom)
                s = s.parent
            }
            return seen.size
        },
    }
}
