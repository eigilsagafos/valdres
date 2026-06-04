import type { Atom } from "../types/Atom"
import type { AtomFamily } from "../types/AtomFamily"
import type { AtomFamilyAtom } from "../types/AtomFamilyAtom"
import type { GetValue } from "../types/GetValue"
import type { Selector } from "../types/Selector"
import type { State } from "../types/State"
import type { StoreData } from "../types/StoreData"
import type { TransactionFn } from "../types/TransactionFn"
import { deepFreeze } from "../utils/deepFreeze"
import { isAtom } from "../utils/isAtom"
import { isAtomFamily } from "../utils/isAtomFamily"
import { isFamilyAtom } from "../utils/isFamilyAtom"
import { isSelector } from "../utils/isSelector"
import { getState } from "./getState"
import { getAtomInitValue } from "./initAtom"
import { isFunction } from "./isFunction"
import { isProd } from "./isProd"
import {
    cloneAtomFamilyIndex,
    renderAtomFamilyIndex,
} from "./atomFamilyIndex"
import {
    propagateAtomUpdate,
    propagateDeletedAtoms,
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
    private _scopedTransactions: undefined | Map<string, Transaction>
    private _initializedAtomsSet: any
    private _deleteSet: any
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
        this._atomMap = new Map()
        if (childTransaction) {
            this._scopedTransactions = new Map([
                [childTransaction.data.id, childTransaction],
            ])
        }
    }

    private hasTxnOrData = (state: State): boolean => {
        if (this._atomMap.has(state)) return true
        if (this.data.values.has(state)) return true
        if (this.parentTransaction) return this.parentTransaction.hasTxnOrData(state)
        return false
    }

    private valueFromTxnOrData: GetValue = (state: State) => {
        if (this._atomMap.has(state)) {
            return this._atomMap.get(state)
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
        // Respect atom.mutable and production mode, matching setValueInData behavior.
        if (!atom.mutable && !isProd() && resolved !== null && (typeof resolved === "object" || typeof resolved === "function")) {
            resolved = deepFreeze(resolved) as V
        }
        this._atomMap.set(atom, resolved)
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
        // Single-store fast path: no scoped transactions to coordinate, so
        // write-and-notify in one pass exactly as before. This keeps the
        // non-scoped txn hot path (the Bencher-gated one) unchanged in both
        // behavior and cost — onSet fires inline during the write loop here.
        if (!this._scopedTransactions) {
            const initializedAtomsSet = new Set<Atom>()
            if (this._deleteSet?.size) {
                // Updates and a delete in one single-store txn: a selector that
                // depends on both an updated atom and the deleted family is
                // reachable by the update pass (propagateAtomUpdate) and the
                // delete pass (propagateDeletedAtoms). Share a guard so it
                // evaluates once. (Splitting setAtoms into writeAtoms + propagate
                // lets the same guard span both passes.)
                const evaluatedSelectors = new Set<Selector>()
                const updatedAtoms = writeAtoms(
                    this._atomMap,
                    this.data,
                    initializedAtomsSet,
                )
                if (updatedAtoms.length > 0) {
                    propagateAtomUpdate(
                        updatedAtoms,
                        this.data,
                        false,
                        evaluatedSelectors,
                    )
                }
                deleteAtomFamilyAtoms(this._deleteSet, this.data)
                propagateDeletedAtoms(
                    [...this._deleteSet],
                    this.data,
                    undefined,
                    undefined,
                    undefined,
                    evaluatedSelectors,
                )
            } else {
                setAtoms(this._atomMap, this.data, initializedAtomsSet)
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
        // descendants). Order matters for correctness with the dedup guard: an
        // ancestor's pass cross-propagates its atom changes into descendant
        // scopes (propagateToScopes), so a scope selector that transitively
        // depends on an ancestor atom is recomputed with final upstream values
        // before the scope's own pass runs. Running leaf-first instead could
        // evaluate such a selector against a still-stale upstream scope selector
        // and the guard would then skip its correcting re-eval.
        //
        // `evaluatedSelectors` is a per-commit guard so a selector reachable by
        // more than one store-pass (e.g. spanning an ancestor atom and a scope
        // atom, or an updated atom and a deleted family) evaluates exactly once:
        // whichever pass reaches it first computes its final value (all writes
        // are already applied, and root-first guarantees upstream selectors are
        // settled first), and later passes skip it. Without the guard the result
        // is still correct — the equality check discards the redundant recompute
        // — but the body would run once per reaching pass.
        const evaluatedSelectors = new Set<Selector>()
        for (const { data, updatedAtoms, deleted } of plan) {
            if (updatedAtoms.length > 0) {
                propagateAtomUpdate(updatedAtoms, data, false, evaluatedSelectors)
            }
            if (deleted) {
                propagateDeletedAtoms(
                    deleted,
                    data,
                    undefined,
                    undefined,
                    undefined,
                    evaluatedSelectors,
                )
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

export const transaction = (callback: TransactionFn, data: StoreData) => {
    const txn = new Transaction(data)
    return txn.execute(callback)
}
