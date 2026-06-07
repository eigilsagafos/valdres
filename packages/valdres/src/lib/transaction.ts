import type { Atom } from "../types/Atom"
import type { AtomFamily } from "../types/AtomFamily"
import type { AtomFamilyAtom } from "../types/AtomFamilyAtom"
import type { GetValue } from "../types/GetValue"
import type { State } from "../types/State"
import type { StoreData } from "../types/StoreData"
import type { TransactionFn } from "../types/TransactionFn"
import { deepFreeze } from "../utils/deepFreeze"
import { isAtom } from "../utils/isAtom"
import { isAtomFamily } from "../utils/isAtomFamily"
import { isFamilyAtom } from "../utils/isFamilyAtom"
import { isSelector } from "../utils/isSelector"
import {
    detachOwnValue,
    effectiveValueAfterUnset,
    reDelegateScopeSubscriptions,
} from "./unsetValue"
import { getState } from "./getState"
import { getAtomInitValue } from "./initAtom"
import { isFunction } from "./isFunction"
import {
    changeListenerRegistry,
    createChangeSink,
    flushChangeSink,
    reportUnsetAtom,
    type ChangeSink,
} from "./notifyChangeListeners"
import { IS_PROD } from "./IS_PROD"
import {
    cloneAtomFamilyIndex,
    renderAtomFamilyIndex,
} from "./atomFamilyIndex"
import {
    notifyDeferred,
    propagateAtomUpdate,
    propagateDeletedAtoms,
    type NotifyTarget,
} from "./propagateUpdatedAtoms"
import { setAtoms } from "./setAtoms"
import { writeAtoms, type DeferredOnSet } from "./writeAtoms"

/** One store's slot in a cross-scope commit. Collected root-first; written
 *  leaf-first (see commit) but notified root-first. */
type CommitWrite = {
    txn: Transaction
    data: StoreData
    updatedAtoms: Atom[]
    deleted: AtomFamilyAtom<any, any>[] | undefined
    unsetAtoms: Atom[] | undefined
    onSets: DeferredOnSet[]
}

// const findDependencies = (
//     state: State,
//     data: StoreData,
//     result = new Set(),
// ) => {
//     const dependents = data.stateDependents.get(state)
//     if (dependents?.size) {
//         for (const dependent of dependents) {
//             if (!result.has(dependent)) {
//                 result.add(dependent)
//                 findDependencies(dependent, data, result)
//             }
//         }
//     }
//     return result
// }

const deleteAtomFamilyAtoms = (
    set: Set<AtomFamilyAtom<any, any>>,
    data: StoreData,
) => {
    set.forEach(atom => {
        data.values.delete(atom)
    })
}

export class Transaction {
    data: StoreData
    parentTransaction: Transaction | undefined
    dirty: boolean
    /** Optional name from `store.txn(callback, name)`, surfaced on the
     *  `store.onChange` meta for this commit. Only meaningful on the root
     *  transaction (the one that commits). */
    name: string | undefined
    private _scopedTransactions: undefined | Map<string, Transaction>
    private _initializedAtomsSet: any
    private _deleteSet: any
    private _unsetSet: Set<Atom> | undefined
    private _selectorDependencies: any
    private _selectorCache: any
    private _atomMap: Map<any, any>
    constructor(
        data: StoreData,
        parentTransaction?: Transaction,
        childTransaction?: Transaction,
    ) {
        this.data = data
        this.parentTransaction = parentTransaction
        this.dirty = false
        this.name = undefined
        this._atomMap = new Map()
        if (childTransaction) {
            this._scopedTransactions = new Map([
                [childTransaction.data.id, childTransaction],
            ])
        }
    }

    private hasTxnOrData = (state: State): boolean => {
        if (this._atomMap.has(state)) return true
        // An unset buffered at this level (and not superseded by a later set)
        // makes this scope provide no value: the committed shadow still sits in
        // this.data.values until commit, so we must NOT read it — fall through
        // to a parent transaction, or report "not here" so `get` reads through
        // the committed parent chain.
        if (this._unsetSet?.has(state)) {
            return this.parentTransaction
                ? this.parentTransaction.hasTxnOrData(state)
                : false
        }
        if (this.data.values.has(state)) return true
        if (this.parentTransaction) return this.parentTransaction.hasTxnOrData(state)
        return false
    }

    private valueFromTxnOrData: GetValue = (state: State) => {
        if (this._atomMap.has(state)) {
            return this._atomMap.get(state)
        }
        if (this._unsetSet?.has(state)) {
            return this.parentTransaction
                ? this.parentTransaction.valueFromTxnOrData(state)
                : undefined
        }
        if (this.data.values.has(state)) {
            return this.data.values.get(state)
        }
        if (this.parentTransaction) {
            return this.parentTransaction.valueFromTxnOrData(state)
        }
    }

    get: GetValue = (state: State<any>) => {
        if (isAtom(state) || isAtomFamily(state)) {
            if (this.hasTxnOrData(state)) {
                return this.valueFromTxnOrData(state)
            }
            // No txn level provides a value. If this level unset the atom, its
            // committed value is still in this.data.values until commit, so we
            // must NOT read it: read through the parent chain (scope) or compute
            // the atom's default (root) instead.
            if (this._unsetSet?.has(state)) {
                return this.data.parent
                    ? getState(state, this.data.parent, this.initializedAtomsSet)
                    : getAtomInitValue(
                          state as Atom,
                          this.data,
                          this.initializedAtomsSet,
                      )
            }
            return getState(state, this.data, this.initializedAtomsSet)
        } else if (isSelector(state)) {
            if (this.dirty) {
                this.selectorCache.clear()
                this.selectorDependencies.clear()
                this.dirty = false
            } else if (this.selectorCache.has(state)) {
                // If the selector is cached and not dirty, return the cached value
                return this.selectorCache.get(state)
            }

            // @ts-ignore
            const res = state.get(s => {
                // Could we optimize this even further? Could we better track selector dependencies and if any of the deps are touched by the transaction?
                if (!this.selectorDependencies.has(s)) {
                    this.selectorDependencies.add(s)
                }
                return this.get(s)
            }, this.data.id)
            this.selectorCache.set(state, res)
            return res
        } else {
            throw new Error("Unsupported state")
        }
    }

    set = <V>(atom: Atom<V>, value: V | ((currentValue: V) => V)): V => {
        if (!isAtom(atom)) throw new Error("Not an atom")
        let resolved: V
        if (isFunction(value)) {
            const currentValue = this.get(atom) as V
            resolved = (value as (current: V) => V)(currentValue)
        } else {
            resolved = value
        }

        // Freeze non-primitives so values are immutable within the transaction.
        // Respect atom.mutable and production mode. Kept in sync with the inline
        // freeze decision in setValueInData.ts (not shared, to avoid a call on the
        // write hot path) — change both together.
        if (!atom.mutable && !IS_PROD && resolved !== null && (typeof resolved === "object" || typeof resolved === "function")) {
            resolved = deepFreeze(resolved) as V
        }
        this._atomMap.set(atom, resolved)
        // A set supersedes an unset of the same atom buffered earlier in this txn
        // (last write wins, regardless of order). Symmetric to `unset` dropping
        // any buffered set.
        this._unsetSet?.delete(atom)
        if (!this.dirty) this.dirty = true

        if (isFamilyAtom(atom)) {
            if (!this._atomMap.has(atom.family)) {
                // @ts-ignore
                this.cloneFamilyIntoTxn(atom.family)
            }
            const index = this._atomMap.get(atom.family).__index
            index.created.set(atom, performance.now())
            index.deleted.delete(atom)
            index.rendered = null
            index.renderedArray = null
            this.recursivelyUpdateAtomFamilyIndexes(atom.family)
        }
        return resolved
    }

    // @ts-ignore
    batchSetFamilyAtoms = (family, pairs) => {
        if (!this._atomMap.has(family)) {
            // @ts-ignore
            this.cloneFamilyIntoTxn(family)
        }
        const index = this._atomMap.get(family).__index
        for (const [atom, value] of pairs) {
            if (atom.family !== family) {
                throw new Error("Atom does not belong to the provided family")
            }
            index.created.set(atom, performance.now())
            if (index.deleted.has(atom)) index.deleted.delete(atom)
            this._atomMap.set(atom, value)
            this._unsetSet?.delete(atom)
        }
        index.rendered = null
        index.renderedArray = null
        this.recursivelyUpdateAtomFamilyIndexes(family)
    }

    del = (atom: AtomFamilyAtom<any, any>) => {
        if (!this._atomMap.has(atom.family)) {
            // @ts-ignore
            this.cloneFamilyIntoTxn(atom.family)
        }
        const index = this._atomMap.get(atom.family).__index
        index.created.delete(atom)
        index.deleted.set(atom, performance.now())
        index.rendered = null
        index.renderedArray = null
        this._atomMap.set(atom.family, renderAtomFamilyIndex(index))
        this.recursivelyUpdateAtomFamilyIndexes(atom.family)
        if (this.data.values.has(atom)) {
            this.deleteSet.add(atom)
        }
        if (this._atomMap.has(atom)) {
            this._atomMap.delete(atom)
        }
    }

    unset = (atom: Atom) => {
        if (!isAtom(atom)) throw new Error("unset() expects an atom.")
        // An unset in the same txn supersedes a set of the same atom — drop any
        // buffered write so the atom reverts (re-inherits on a scope / reverts to
        // its default on a root) rather than being re-written.
        this._atomMap.delete(atom)
        if (!this._unsetSet) this._unsetSet = new Set()
        this._unsetSet.add(atom)
    }

    // Detach the own value + bookkeeping for each unset atom that actually had
    // one; returns those atoms so the commit can propagate and report them.
    // Called in the write phase so every store's values are final before any
    // propagation pass runs.
    private applyUnsets = (unsetSet: Set<Atom>, data: StoreData): Atom[] => {
        const unsetAtoms: Atom[] = []
        for (const atom of unsetSet) {
            if (detachOwnValue(atom, data)) unsetAtoms.push(atom)
        }
        return unsetAtoms
    }

    scope = (scopeId: string, callback: (txn: Transaction) => any) => {
        if (this.data.scopes.has(scopeId)) {
            // @ts-ignore
            return this.scopedTransaction(scopeId).execute(callback, false)
        } else {
            throw new Error(
                `Scope '${scopeId}' not found. Registered scopes: ${[...this.data.scopes.keys()].join(", ")}`,
            )
        }
    }

    parentScope = (callback: (txn: Transaction) => any) => {
        if (!this.parentTransaction) {
            if (!this.data.parent) {
                throw new Error("Cannot access parentScope on root store")
            }
            this.parentTransaction = new Transaction(
                this.data.parent,
                undefined,
                this,
            )
        }
        return this.parentTransaction.execute(callback, false)
    }

    reset = (atom: Atom) => {
        const value = getAtomInitValue(
            atom,
            this.data,
            this.initializedAtomsSet,
        )
        this._atomMap.set(atom, value)
        // reset writes the default; it supersedes a buffered unset of the atom.
        this._unsetSet?.delete(atom)
        return value
    }

    execute = (callback: TransactionFn, autoCommit = true) => {
        const result = callback(this)
        if (autoCommit) this.txnCommit()
        return result
    }

    private txnCommit = () => {
        if (this.parentTransaction) {
            this.parentTransaction.txnCommit()
        } else {
            this.commit()
        }
    }

    commit = () => {
        // When nothing is watching, commit directly — no sink allocation, so the
        // Bencher-gated txn hot path is unchanged.
        if (changeListenerRegistry.count === 0) {
            this.commitWork(undefined)
            return
        }
        // Otherwise thread a change sink through the commit's per-store
        // propagation passes so they collapse into a single store.onChange
        // callback, tagged "transaction" with this txn's name. The sink is a
        // local (not global state), so a transaction started inside an onSet hook
        // simply owns its own sink — no save/restore. Flush in `finally` so
        // observers still see the (already-applied) changes if a subscriber
        // throws during commit.
        const sink = createChangeSink(this.name)
        try {
            this.commitWork(sink)
        } catch (error) {
            // The commit failed (e.g. a subscriber threw), but its writes were
            // already applied, so still flush onChange — best-effort, never
            // letting an onChange-listener error mask the original failure.
            try {
                flushChangeSink(sink)
            } catch {}
            throw error
        }
        // Commit succeeded: onChange-listener errors propagate normally.
        flushChangeSink(sink)
    }

    private commitWork = (sink: ChangeSink | undefined) => {
        // Single-store fast path: no scoped transactions to coordinate, so
        // write-and-notify in one pass. onSet fires inline during the write loop.
        if (!this._scopedTransactions) {
            const initializedAtomsSet = new Set<Atom>()
            if (this._unsetSet?.size) {
                // An unset empties this scope value, so it can't share the
                // single-pass setAtoms path (which reports out of data.values).
                // Write any set atoms, then detach + propagate the unsets into the
                // same deferred notify so subscribers fire once with final state.
                const notify: NotifyTarget = new Map()
                const updatedAtoms = writeAtoms(
                    this._atomMap,
                    this.data,
                    initializedAtomsSet,
                )
                if (updatedAtoms.length > 0) {
                    propagateAtomUpdate(updatedAtoms, this.data, false, notify, sink)
                }
                if (this._deleteSet?.size) {
                    deleteAtomFamilyAtoms(this._deleteSet, this.data)
                    propagateDeletedAtoms(
                        [...this._deleteSet],
                        this.data,
                        undefined,
                        undefined,
                        undefined,
                        notify,
                        sink,
                    )
                }
                const unsetAtoms = this.applyUnsets(this._unsetSet, this.data)
                if (unsetAtoms.length > 0) {
                    propagateAtomUpdate(unsetAtoms, this.data, false, notify, undefined)
                    if (sink) {
                        for (const atom of unsetAtoms) {
                            reportUnsetAtom(
                                atom,
                                this.data,
                                effectiveValueAfterUnset(atom, this.data),
                                sink,
                            )
                        }
                    }
                }
                notifyDeferred(notify)
                // Re-delegate AFTER firing: the deferred notify fires the
                // scope-local callback (which idempotently drops the delegate),
                // so re-establishing the parent delegate must come last.
                for (const atom of unsetAtoms) {
                    reDelegateScopeSubscriptions(atom, this.data)
                }
            } else if (this._deleteSet?.size) {
                // Updates and a delete in one single-store txn: a selector that
                // depends on both an updated atom and the deleted family is
                // reachable by the update pass (propagateAtomUpdate) and the
                // delete pass (propagateDeletedAtoms). Defer subscriber
                // notification across both passes so an observer never sees the
                // update pass's value of a selector the delete pass recomputes
                // (and vice versa). No cross-pass dedup guard: each pass
                // re-derives its selectors against the fully-written state, so
                // the later pass corrects any value the earlier one computed
                // from a not-yet-final selector input. (See NotifyTarget.)
                const notify: NotifyTarget = new Map()
                const updatedAtoms = writeAtoms(
                    this._atomMap,
                    this.data,
                    initializedAtomsSet,
                )
                if (updatedAtoms.length > 0) {
                    propagateAtomUpdate(updatedAtoms, this.data, false, notify, sink)
                }
                deleteAtomFamilyAtoms(this._deleteSet, this.data)
                propagateDeletedAtoms(
                    [...this._deleteSet],
                    this.data,
                    undefined,
                    undefined,
                    undefined,
                    notify,
                    sink,
                )
                notifyDeferred(notify)
            } else {
                setAtoms(this._atomMap, this.data, initializedAtomsSet, false, sink)
            }
            return
        }

        // Cross-scope path: write the whole tree (root + every nested scope)
        // first, then run a single notification pass per store. This guarantees
        // no subscriber, onSet hook, or selector ever observes a half-applied
        // transaction — root written while a scope isn't, or scope A written
        // while scope B isn't. The final committed state is identical to the
        // old sequential model; only the observation point moves.
        const plan: CommitWrite[] = []
        this.collectStores(plan)

        // Write leaf-first (descendants before ancestors — the reverse of the
        // root-first plan). A scope's equality check reads through the chain via
        // getState; writing the parent first would let the parent's new value
        // mask a scope's own change. Concretely: a scope that newly shadows a
        // root atom with the same value the root is simultaneously set to would
        // see "no change" (its getState already returns the parent's new value)
        // AND be skipped by the root's propagateToScopes (its shadow is now
        // tracked), so its selectors would never recompute. Leaf-first makes
        // each store decide against its genuine pre-transaction value.
        for (let i = plan.length - 1; i >= 0; i--) {
            const entry = plan[i]
            const txn = entry.txn
            entry.updatedAtoms = writeAtoms(
                txn._atomMap,
                entry.data,
                new Set<Atom>(),
                false,
                entry.onSets,
            )
            if (txn._deleteSet?.size) {
                deleteAtomFamilyAtoms(txn._deleteSet, entry.data)
                entry.deleted = [...txn._deleteSet]
            }
            if (txn._unsetSet?.size) {
                // Detach shadows in the write phase so every store's values are
                // final before any propagation pass reads through the chain.
                entry.unsetAtoms = txn.applyUnsets(txn._unsetSet, entry.data)
            }
        }

        // Every value across the tree is now applied. onSet hooks fire here, in
        // the notify phase, so a hook reading any atom — root or scope — sees
        // the fully-applied transaction. Fired root-first (matching the old
        // model's order) and before any subscriber, preserving the
        // long-standing onSet-before-subscribers ordering. (Deliberate
        // placement: in the old model onSet fired mid-write-loop and a
        // cross-scope hook could read a not-yet-written scope value. Deferring
        // to here is the only placement consistent with atomicity.)
        for (const entry of plan) {
            for (const [atom, value, data] of entry.onSets) {
                atom.onSet!(value, data)
            }
        }

        // One propagation pass per store, root-first (ancestors before
        // descendants). Order matters: an ancestor's pass cross-propagates its
        // atom changes into descendant scopes (propagateToScopes), so a scope
        // selector that transitively depends on an ancestor atom is recomputed
        // with final upstream values before — or again in — the scope's own pass.
        //
        // Defer all subscriber notification to the end of the commit. Each
        // store's pass settles its own selectors against the fully-written
        // state (root-first, so read-through ancestor values are final); firing
        // only after every pass has run means every observer reads the final,
        // consistent snapshot — never a value a later pass still corrects
        // (serializable observation). There is deliberately NO cross-pass dedup
        // guard: a selector reachable by two passes is simply recomputed in each
        // (the equality check prunes the redundant result), and the deferred
        // notification fires its subscriber exactly once. See the warning on
        // NotifyTarget for why a dedup guard must not come back.
        const notify: NotifyTarget = new Map()
        for (const { data, updatedAtoms, deleted, unsetAtoms } of plan) {
            if (updatedAtoms.length > 0) {
                propagateAtomUpdate(updatedAtoms, data, false, notify, sink)
            }
            if (deleted) {
                propagateDeletedAtoms(
                    deleted,
                    data,
                    undefined,
                    undefined,
                    undefined,
                    notify,
                    sink,
                )
            }
            if (unsetAtoms && unsetAtoms.length > 0) {
                // report undefined: the unset atom value is gone from
                // data.values; emit the reverted value via reportUnsetAtom.
                propagateAtomUpdate(unsetAtoms, data, false, notify, undefined)
                if (sink) {
                    for (const atom of unsetAtoms) {
                        reportUnsetAtom(
                            atom,
                            data,
                            effectiveValueAfterUnset(atom, data),
                            sink,
                        )
                    }
                }
            }
        }
        notifyDeferred(notify)
        // Re-delegate AFTER firing (notifyDeferred): the scope-local callback
        // idempotently drops its delegate when it fires, so the fresh parent
        // delegate must be (re)established last.
        for (const { data, unsetAtoms } of plan) {
            if (unsetAtoms) {
                for (const atom of unsetAtoms) {
                    reDelegateScopeSubscriptions(atom, data)
                }
            }
        }
    }

    // Depth-first pre-order: this store, then each nested scope. Produces a
    // root-first plan used directly for the notify pass and reversed for the
    // write pass (so descendants are written before their ancestors).
    private collectStores = (plan: CommitWrite[]) => {
        plan.push({
            txn: this,
            data: this.data,
            updatedAtoms: [],
            deleted: undefined,
            unsetAtoms: undefined,
            onSets: [],
        })
        if (this._scopedTransactions) {
            for (const [, scopedTxn] of this._scopedTransactions) {
                scopedTxn.collectStores(plan)
            }
        }
    }

    private get selectorCache() {
        if (!this._selectorCache) this._selectorCache = new Map()
        return this._selectorCache
    }

    private get selectorDependencies() {
        if (!this._selectorDependencies) this._selectorDependencies = new Set()
        return this._selectorDependencies
    }
    private get deleteSet() {
        if (!this._deleteSet) this._deleteSet = new Set()
        return this._deleteSet
    }

    private get initializedAtomsSet() {
        if (!this._initializedAtomsSet) this._initializedAtomsSet = new Set()
        return this._initializedAtomsSet
    }

    private scopedTransaction(scopeId: string) {
        if (!this._scopedTransactions) this._scopedTransactions = new Map()
        if (!this._scopedTransactions.has(scopeId)) {
            const scopedData = this.data.scopes.get(scopeId)!
            const scopedTransaction = new Transaction(scopedData, this)
            this._scopedTransactions.set(scopeId, scopedTransaction)
        }
        return this._scopedTransactions.get(scopeId)
    }

    private cloneFamilyIntoTxn(
        family: any,
        // @ts-ignore
        parentIndex,
        moveUpIfParent = true,
    ): void {
        if (moveUpIfParent && this.parentTransaction)
            return this.parentTransaction.cloneFamilyIntoTxn(
                family,
                parentIndex,
                moveUpIfParent,
            )
        const currentFamilyList = this.get(family)
        const clonedIndex = cloneAtomFamilyIndex(
            // @ts-ignore
            currentFamilyList.__index,
            parentIndex,
        )
        if (this._scopedTransactions?.size) {
            for (const [, scopedTxn] of this._scopedTransactions) {
                scopedTxn.cloneFamilyIntoTxn(family, clonedIndex, false)
            }
        }
        this._atomMap.set(family, renderAtomFamilyIndex(clonedIndex))
    }

    private recursivelyUpdateAtomFamilyIndexes(
        atomFamily: AtomFamily<any, any>,
    ) {
        const currentIndex = this._atomMap.get(atomFamily).__index
        currentIndex.rendered = null
        currentIndex.renderedArray = null
        const updatedValue = renderAtomFamilyIndex(currentIndex)
        this._atomMap.set(atomFamily, updatedValue)

        if (this._scopedTransactions?.size) {
            for (const [, scopedTxn] of this._scopedTransactions) {
                scopedTxn.recursivelyUpdateAtomFamilyIndexes(atomFamily)
            }
        }
    }
}

export const transaction = (
    callback: TransactionFn,
    data: StoreData,
    name?: string,
) => {
    const txn = new Transaction(data)
    txn.name = name
    return txn.execute(callback)
}
