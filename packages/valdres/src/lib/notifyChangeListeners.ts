import type { Atom } from "../types/Atom"
import type { AtomFamilyAtom } from "../types/AtomFamilyAtom"
import type { StoreChange } from "../types/StoreChange"
import type { StoreChangeMeta } from "../types/StoreChangeMeta"
import type { StoreChangeSource } from "../types/StoreChangeSource"
import type { StoreData } from "../types/StoreData"
import { isAtomFamily } from "../utils/isAtomFamily"

/** One store's slice of an operation's changes. */
export type ChangeGroup = {
    data: StoreData
    changes: StoreChange[]
}

/** A transaction's deferred change accumulator. Created once per watched commit,
 *  threaded (like NotifyTarget) through the commit's per-store propagation
 *  passes, and flushed once at the end — so a whole transaction produces exactly
 *  one `onChange` callback, serializable by construction (no save/restore global
 *  state; reentrancy is handled by each commit owning its own sink). */
export type ChangeSink = {
    source: StoreChangeSource
    name: string | undefined
    groups: ChangeGroup[]
}

/** Where a propagation's change reports go: a bare `source` tag means emit
 *  immediately with that source (a direct set/reset/del/revalidation/async
 *  resolution); a `ChangeSink` means buffer into the in-flight transaction.
 *  Passed as a normal argument — never ambient state. */
export type ChangeReport = StoreChangeSource | ChangeSink

/** Global listener count across every store — the cheap "is anyone watching at
 *  all" gate. Every emit site checks `count !== 0` first, so when nothing
 *  anywhere is watching (the overwhelmingly common case) the change pipeline
 *  does a single property read and no work or allocation. Maintained by
 *  onStoreChange. (Unlike the per-commit sink, this is legitimately global: it
 *  only changes on subscribe/unsubscribe, never mid-traversal.) */
export const changeListenerRegistry = { count: 0 }

/** True iff `data` or any ancestor store has a change listener. Short-circuits
 *  on the global count, then walks the parent chain (a change in a scope is
 *  reported to listeners on that scope AND every store above it). */
export const hasChangeListener = (data: StoreData): boolean => {
    if (changeListenerRegistry.count === 0) return false
    let store: StoreData | undefined = data
    while (store) {
        const listeners = store.changeListeners
        if (listeners !== undefined && listeners.size > 0) return true
        store = store.parent
    }
    return false
}

/** The scope path to report for a change that occurred in `data`: the chain of
 *  scope ids from the outermost scope down to `data`, i.e. the ids you'd pass to
 *  `.scope()` to reach it. Empty for a root store. */
const scopePath = (data: StoreData): string[] => {
    const path: string[] = []
    let store: StoreData | undefined = data
    while (store && store.parent) {
        path.push(store.id)
        store = store.parent
    }
    path.reverse()
    return path
}

/** Deliver an operation's changes to every relevant listener, once each.
 *
 *  A listener on store S receives the changes that occurred in S or any of its
 *  descendant scopes — and only those. We achieve that by walking each group's
 *  origin store up the parent chain and accumulating that group's changes into
 *  every ancestor (and the origin itself) that has listeners. */
export const notifyChangeListeners = (
    groups: ChangeGroup[],
    meta: StoreChangeMeta,
) => {
    let buckets: Map<StoreData, StoreChange[]> | undefined
    for (const group of groups) {
        if (group.changes.length === 0) continue
        let store: StoreData | undefined = group.data
        while (store) {
            const listeners = store.changeListeners
            if (listeners !== undefined && listeners.size > 0) {
                if (!buckets) buckets = new Map()
                let bucket = buckets.get(store)
                if (!bucket) {
                    bucket = []
                    buckets.set(store, bucket)
                }
                for (const change of group.changes) bucket.push(change)
            }
            store = store.parent
        }
    }
    if (!buckets) return
    for (const [store, changes] of buckets) {
        // Re-read per store: a listener fired for an earlier bucket may have
        // unsubscribed every listener on this one (clearing changeListeners),
        // so this store's set can be gone by the time we reach it.
        const listeners = store.changeListeners
        if (listeners === undefined || listeners.size === 0) continue
        // Snapshot so a listener that unsubscribes mid-dispatch doesn't skip a
        // sibling, and capture errors so one listener can't starve the rest.
        let firstError: unknown
        let hasError = false
        for (const listener of [...listeners]) {
            try {
                listener(changes, meta)
            } catch (error) {
                if (!hasError) {
                    firstError = error
                    hasError = true
                }
            }
        }
        if (hasError) throw firstError
    }
}

/** Build one store's change group from the atoms that changed and/or were
 *  deleted in it. Changed atoms become `{ kind: "set", value }` (value read back
 *  out of `data.values` — values are always written before propagation runs);
 *  deleted atoms become `{ kind: "delete" }` with no value.
 *
 *  Skipped: valdres-internal atoms (`__valdresInternal`, e.g. cacheMeta) and
 *  atom-family container objects (an `AtomFamily` flows through propagation when
 *  its membership changes, but individual members are reported on their own as
 *  family-atom sets/deletions — the container is internal bookkeeping). `atoms`
 *  may contain duplicates (writeAtoms merges lazily-initialized atoms into its
 *  changed list); we dedupe by identity. */
const buildChangeGroup = (
    data: StoreData,
    changedAtoms?: (Atom<any> | AtomFamilyAtom<any, any>)[],
    deletedAtoms?: (Atom<any> | AtomFamilyAtom<any, any>)[],
): ChangeGroup => {
    const scope = scopePath(data)
    const changes: StoreChange[] = []
    let seen: Set<unknown> | undefined
    if (changedAtoms) {
        for (const atom of changedAtoms) {
            if (atom.__valdresInternal || isAtomFamily(atom)) continue
            if (seen?.has(atom)) continue
            ;(seen ??= new Set()).add(atom)
            changes.push({ kind: "set", atom, value: data.values.get(atom), scope })
        }
    }
    if (deletedAtoms) {
        for (const atom of deletedAtoms) {
            if (atom.__valdresInternal || isAtomFamily(atom)) continue
            changes.push({ kind: "delete", atom, scope })
        }
    }
    return { data, changes }
}

/** Route one group per `report`: buffer into a transaction sink, or fire
 *  immediately tagged with the source. Internal — call via reportAtomChanges /
 *  reportDeletedAtoms. */
const emitGroup = (group: ChangeGroup, report: ChangeReport) => {
    if (group.changes.length === 0) return
    if (typeof report === "string") {
        notifyChangeListeners([group], { source: report })
    } else {
        report.groups.push(group)
    }
}

/** Report the atoms whose values just changed in `data` (called from
 *  propagateAtomUpdate, after values are written). Guards on the precise
 *  ancestor check so a store nobody watches does no allocation. */
export const reportAtomChanges = (
    atoms: (Atom<any> | AtomFamilyAtom<any, any>)[],
    data: StoreData,
    report: ChangeReport,
) => {
    if (!hasChangeListener(data)) return
    emitGroup(buildChangeGroup(data, atoms), report)
}

/** Report that `atom`'s own value in scope `data` was unset (called from
 *  unsetScopeValue, after the shadow and its bookkeeping have been removed). The
 *  scope now inherits `inheritedValue` from its parent chain, so the change is a
 *  `kind: "set"` carrying that value — NOT a `"delete"` (the atom still exists,
 *  only the scope override is gone). The originating `source` ("unset", or
 *  "transaction" when buffered into a txn) lives on the change batch's meta. */
export const reportUnsetAtom = (
    atom: Atom<any>,
    data: StoreData,
    inheritedValue: unknown,
    report: ChangeReport,
) => {
    if (!hasChangeListener(data)) return
    const group: ChangeGroup = {
        data,
        changes: [
            { kind: "set", atom, value: inheritedValue, scope: scopePath(data) },
        ],
    }
    emitGroup(group, report)
}

/** Report deleted family atoms in `data` (called from propagateDeletedAtoms). */
export const reportDeletedAtoms = (
    atoms: (Atom<any> | AtomFamilyAtom<any, any>)[],
    data: StoreData,
    report: ChangeReport,
) => {
    if (!hasChangeListener(data)) return
    emitGroup(buildChangeGroup(data, undefined, atoms), report)
}

/** Create a transaction's change sink. `source` is `"transaction"`; `name` is
 *  the optional `store.txn(fn, name)` label. */
export const createChangeSink = (name: string | undefined): ChangeSink => ({
    source: "transaction",
    name,
    groups: [],
})

/** Flush a transaction's accumulated changes as a single callback. */
export const flushChangeSink = (sink: ChangeSink) => {
    if (sink.groups.length > 0) {
        notifyChangeListeners(sink.groups, { source: sink.source, name: sink.name })
    }
}
