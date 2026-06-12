import type { Atom } from "../types/Atom"
import type { AtomFamilyAtom } from "../types/AtomFamilyAtom"
import type { Selector } from "../types/Selector"
import type { StoreChange } from "../types/StoreChange"
import type { StoreChangeMeta } from "../types/StoreChangeMeta"
import type { StoreChangeSource } from "../types/StoreChangeSource"
import type { StoreData } from "../types/StoreData"
import { isAtomFamily } from "../utils/isAtomFamily"
import { isSelectorFamily } from "../utils/isSelectorFamily"

/** One store's slice of an operation's changes. */
export type ChangeGroup = {
    data: StoreData
    changes: StoreChange[]
}

/** A transaction's deferred change accumulator. Created once per watched commit,
 *  threaded (like NotifyTarget) through the commit's per-store propagation
 *  passes, and flushed once at the end — so a whole transaction produces exactly
 *  one `onChange` callback, serializable by construction (no save/restore global
 *  state; reentrancy is handled by each commit owning its own sink).
 *
 *  Also used by the immediate (non-transaction) path when a selector listener is
 *  active: a single set/del that cascades selector recomputes into descendant
 *  scopes produces multiple groups, and buffering them into one sink (tagged
 *  with the real `source`, not `"transaction"`) keeps it one callback. */
export type ChangeSink = {
    source: StoreChangeSource
    name: string | undefined
    origin: string | undefined
    groups: ChangeGroup[]
}

/** Where a propagation's change reports go: a bare `source` tag means emit
 *  immediately with that source (a direct set/reset/del/revalidation/async
 *  resolution); a `ChangeSink` means buffer into the in-flight transaction.
 *  Passed as a normal argument — never ambient state. */
export type ChangeReport = StoreChangeSource | ChangeSink

/** Global listener counts across every store — the cheap "is anyone watching"
 *  gates. Every emit site checks `count !== 0` first, so when nothing anywhere
 *  is watching (the overwhelmingly common case) the change pipeline does a
 *  single property read and no work or allocation. `selectorCount` is the same
 *  gate for selector reporting: when zero, selector collection never allocates
 *  and the propagation hot path is byte-identical to before the feature.
 *  Maintained by onStoreChange. (Unlike the per-commit sink, these are
 *  legitimately global: they only change on subscribe/unsubscribe, never
 *  mid-traversal.) */
export const changeListenerRegistry = { count: 0, selectorCount: 0 }

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

/** True iff `data` or any ancestor has a listener that opted into selector
 *  changes. Gates whether selector entries are worth emitting for a change in
 *  `data`. Short-circuits on the global selectorCount. */
export const hasSelectorChangeListener = (data: StoreData): boolean => {
    if (changeListenerRegistry.selectorCount === 0) return false
    let store: StoreData | undefined = data
    while (store) {
        const listeners = store.changeListeners
        if (listeners !== undefined) {
            for (const flags of listeners.values()) {
                if (flags.selectors) return true
            }
        }
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
 *  every ancestor (and the origin itself) that has listeners.
 *
 *  A listener that did NOT opt into selectors receives only `type: "atom"`
 *  entries (an atoms-only view, built lazily per bucket). Selector entries only
 *  exist when a selector listener is active, so the common path hands every
 *  listener the same array with no filtering. */
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
        // Per-listener views, built at most once per bucket and only when a
        // listener actually needs a filtered slice. When the bucket has no
        // selector entries (the common case) `atomOnly` is the original array —
        // no allocation; likewise `selectorOnly` when there are no atom entries.
        let hasSelector: boolean | undefined
        let hasAtom: boolean | undefined
        let atomOnly: readonly StoreChange[] | undefined
        let selectorOnly: readonly StoreChange[] | undefined
        // Snapshot so a listener that unsubscribes mid-dispatch doesn't skip a
        // sibling, and capture errors so one listener can't starve the rest.
        let firstError: unknown
        let hasError = false
        for (const [listener, flags] of [...listeners]) {
            let payload: readonly StoreChange[]
            if (flags.atoms && flags.selectors) {
                payload = changes
            } else if (flags.atoms) {
                if (atomOnly === undefined) {
                    hasSelector ??= changes.some(c => c.type === "selector")
                    atomOnly = hasSelector
                        ? changes.filter(c => c.type === "atom")
                        : changes
                }
                payload = atomOnly
            } else if (flags.selectors) {
                if (selectorOnly === undefined) {
                    hasAtom ??= changes.some(c => c.type === "atom")
                    selectorOnly = hasAtom
                        ? changes.filter(c => c.type === "selector")
                        : changes
                }
                payload = selectorOnly
            } else {
                continue // listener opted out of everything
            }
            // Don't fire an empty callback — e.g. an atoms-only listener whose
            // bucket carried only descendant-scope selector changes.
            if (payload.length === 0) continue
            try {
                listener(payload, meta)
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
 *  deleted in it, plus any selectors that recomputed to a new value. Changed
 *  atoms become `{ type: "atom", kind: "set", value }` (value read back out of
 *  `data.values` — values are always written before propagation runs); deleted
 *  atoms become `{ kind: "delete" }` with no value; changed selectors become
 *  `{ type: "selector", value }` (no `kind` — a selector has no operation),
 *  appended AFTER the atom entries so a store's atoms precede its derived
 *  changes.
 *
 *  Skipped: valdres-internal atoms/selectors (`__valdresInternal`, e.g.
 *  cacheMeta) and family container objects (an `AtomFamily`/`SelectorFamily`
 *  flows through propagation when its membership changes, but individual members
 *  are reported on their own). A selector whose re-eval threw has its cached
 *  value dropped — skipped, there is no value to report. `atoms` may contain
 *  duplicates (writeAtoms merges lazily-initialized atoms into its changed
 *  list); we dedupe by identity. */
const buildChangeGroup = (
    data: StoreData,
    changedAtoms?: (Atom<any> | AtomFamilyAtom<any, any>)[],
    deletedAtoms?: (Atom<any> | AtomFamilyAtom<any, any>)[],
    changedSelectors?: Set<Selector<any>>,
): ChangeGroup => {
    const scope = scopePath(data)
    const changes: StoreChange[] = []
    let seen: Set<unknown> | undefined
    if (changedAtoms) {
        for (const atom of changedAtoms) {
            if (atom.__valdresInternal || isAtomFamily(atom)) continue
            if (seen?.has(atom)) continue
            ;(seen ??= new Set()).add(atom)
            changes.push({
                type: "atom",
                kind: "set",
                state: atom,
                value: data.values.get(atom),
                scope,
            })
        }
    }
    if (deletedAtoms) {
        for (const atom of deletedAtoms) {
            if (atom.__valdresInternal || isAtomFamily(atom)) continue
            changes.push({ type: "atom", kind: "delete", state: atom, scope })
        }
    }
    if (changedSelectors) {
        for (const selector of changedSelectors) {
            if (
                (selector as { __valdresInternal?: boolean }).__valdresInternal ||
                isSelectorFamily(selector)
            )
                continue
            if (!data.values.has(selector)) continue
            changes.push({
                type: "selector",
                state: selector,
                value: data.values.get(selector),
                scope,
            })
        }
    }
    return { data, changes }
}

/** Route one group per `report`: buffer into a transaction sink, or fire
 *  immediately tagged with the source. Internal — call via reportAtomChanges /
 *  reportDeletedAtoms / reportSelectorChanges. */
const emitGroup = (group: ChangeGroup, report: ChangeReport) => {
    if (group.changes.length === 0) return
    if (typeof report === "string") {
        notifyChangeListeners([group], { source: report })
    } else {
        report.groups.push(group)
    }
}

/** Report the atoms whose values just changed in `data` (called from
 *  propagateAtomUpdate, after values are written), plus any selectors that
 *  recomputed in the same pass. Guards on the precise ancestor check so a store
 *  nobody watches does no allocation; selectors are appended only when an
 *  ancestor actually wants them. */
export const reportAtomChanges = (
    atoms: (Atom<any> | AtomFamilyAtom<any, any>)[],
    data: StoreData,
    report: ChangeReport,
    changedSelectors?: Set<Selector<any>>,
) => {
    if (!hasChangeListener(data)) return
    const selectors =
        changedSelectors && changedSelectors.size > 0 && hasSelectorChangeListener(data)
            ? changedSelectors
            : undefined
    emitGroup(buildChangeGroup(data, atoms, undefined, selectors), report)
}

/** Report that `data`'s own value for `atom` was unset (called from unsetValue,
 *  after the value and its bookkeeping have been removed). The store now reads
 *  `revertedValue` — the inherited parent value on a scope, or the default on a
 *  root — carried as the change's `value`. The change is a `kind: "unset"`, NOT
 *  a `"set"` (so a consumer can drop the override rather than treat the reverted
 *  value as a new write) and NOT a `"delete"` (the atom still exists, only this
 *  store's own value is gone). The batch's `meta.source` is "unset" for a
 *  standalone unset, or "transaction" when buffered into a txn — but the
 *  per-change kind stays "unset" either way, so it's distinguishable even inside
 *  a mixed transaction. */
export const reportUnsetAtom = (
    atom: Atom<any>,
    data: StoreData,
    revertedValue: unknown,
    report: ChangeReport,
) => {
    if (!hasChangeListener(data)) return
    const group: ChangeGroup = {
        data,
        changes: [
            {
                type: "atom",
                kind: "unset",
                state: atom,
                value: revertedValue,
                scope: scopePath(data),
            },
        ],
    }
    emitGroup(group, report)
}

/** Report deleted family atoms in `data` (called from propagateDeletedAtoms),
 *  plus any selectors the deletion recomputed. */
export const reportDeletedAtoms = (
    atoms: (Atom<any> | AtomFamilyAtom<any, any>)[],
    data: StoreData,
    report: ChangeReport,
    changedSelectors?: Set<Selector<any>>,
) => {
    if (!hasChangeListener(data)) return
    const selectors =
        changedSelectors && changedSelectors.size > 0 && hasSelectorChangeListener(data)
            ? changedSelectors
            : undefined
    emitGroup(buildChangeGroup(data, undefined, atoms, selectors), report)
}

/** Report selectors that recomputed in a descendant scope where no atom value
 *  changed (called from propagateInScope). Emits a selector-only group, and only
 *  when an ancestor actually opted into selector changes. */
export const reportSelectorChanges = (
    changedSelectors: Set<Selector<any>>,
    data: StoreData,
    report: ChangeReport,
) => {
    if (changedSelectors.size === 0) return
    if (!hasSelectorChangeListener(data)) return
    emitGroup(buildChangeGroup(data, undefined, undefined, changedSelectors), report)
}

/** Create a change sink. `source` defaults to `"transaction"` (the txn commit
 *  path); the immediate path passes the operation's real source so a cascaded,
 *  buffered batch still reports its true origin. `name` is the optional
 *  `store.txn(fn, name)` dev-tools label; `origin` is the optional
 *  machine-readable provenance tag (`store.txn(fn, { origin })`). The immediate
 *  (non-transaction) path passes neither. */
export const createChangeSink = (
    name: string | undefined,
    source: StoreChangeSource = "transaction",
    origin: string | undefined = undefined,
): ChangeSink => ({
    source,
    name,
    origin,
    groups: [],
})

/** Flush a sink's accumulated changes as a single callback. */
export const flushChangeSink = (sink: ChangeSink) => {
    if (sink.groups.length > 0) {
        notifyChangeListeners(sink.groups, {
            source: sink.source,
            name: sink.name,
            origin: sink.origin,
        })
    }
}
