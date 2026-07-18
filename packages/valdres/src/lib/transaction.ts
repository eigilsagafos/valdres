import type { Atom } from "../types/Atom"
import type { AtomFamily } from "../types/AtomFamily"
import type { AtomFamilyAtom } from "../types/AtomFamilyAtom"
import type { GetValue } from "../types/GetValue"
import type { State } from "../types/State"
import type { SetAtomValue } from "../types/SetAtomValue"
import type { StoreData } from "../types/StoreData"
import type { TransactionFn } from "../types/TransactionFn"
import { deepFreeze } from "../utils/deepFreeze"
import { validateSchema } from "./validateSchema"
import { isAtom } from "../utils/isAtom"
import { isAtomFamily } from "../utils/isAtomFamily"
import { isFamilyAtom } from "../utils/isFamilyAtom"
import { isPromiseLike } from "../utils/isPromiseLike"
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
import { beginCommit, commitEndRegistry, endCommit } from "./onCommitEnd"
import { IS_PROD } from "./IS_PROD"
import {
    createCommitErrors,
    recordCommitError,
    throwCommitError,
} from "./commitErrors"
import {
    applyGlobalOnSets,
    beginGlobalCommit,
    endGlobalCommit,
} from "./globalAtomFanOut"
import {
    cloneAtomFamilyIndex,
    createAtomFamilyIndex,
    renderAtomFamilyIndex,
} from "./atomFamilyIndex"
import {
    notifyDeferred,
    propagateAtomUpdate,
    propagateDeletedAtoms,
    type NotifyTarget,
} from "./propagateUpdatedAtoms"
import { setAtoms } from "./setAtoms"
import { runOnSets, writeAtoms, type DeferredOnSet } from "./writeAtoms"
import {
    evaluateSelectorValue,
    type SelectorEvaluationRuntime,
} from "./initSelector"

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
    private _unsetSet: Set<Atom<any>> | undefined
    private _selectorCache: any
    private _selectorRuntime: SelectorEvaluationRuntime | undefined
    private _selectorCircularDependencySet: WeakSet<any> | undefined
    private _atomMap: Map<any, any>
    // Global atoms always carry an onSet marker, so this one bit covers every
    // write that needs phased hook/fan-out handling. Transactions containing
    // only ordinary atoms retain the original allocation-light commit path.
    private _hasCommitEffects = false
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
                this.dirty = false
            } else if (this.selectorCache.has(state)) {
                // If the selector is cached and not dirty, return the cached value
                return this.selectorCache.get(state)
            }

            const res = evaluateSelectorValue(
                state,
                this.data,
                this.initializedAtomsSet,
                this.get,
                this.selectorCircularDependencySet,
                this.selectorRuntime,
            )
            this.selectorCache.set(state, res)
            return res
        } else {
            throw new Error("Unsupported state")
        }
    }

    set = <V>(atom: Atom<V>, value: SetAtomValue<V>): V => {
        if (!isAtom(atom)) throw new Error("Not an atom")
        let resolved: V | PromiseLike<V>
        if (isFunction(value)) {
            const currentValue = this.get(atom) as V
            resolved = value(currentValue)
        } else {
            resolved = value
        }

        // Freeze settled non-primitives so values are immutable within the
        // transaction. Promise-like inputs are normalized by the async-write
        // coordinator at commit and must remain usable until then. Respect
        // atom.mutable and production mode. Kept inline (not shared, to avoid a
        // call on the write hot path).
        if (
            !atom.mutable &&
            !IS_PROD &&
            resolved !== null &&
            (typeof resolved === "object" || typeof resolved === "function") &&
            !isPromiseLike(resolved)
        ) {
            resolved = deepFreeze(resolved)
        }
        // Validate at staging time (inside the txn body), not at commit: a
        // failure throws here, so the user's callback aborts and commit never
        // runs — the transaction stays atomic. Promise-like values are skipped
        // here and validated after settlement by coordinateAsyncWrite during the
        // commit path. This also covers stores using implicit batched txns.
        resolved = validateSchema(atom, resolved, this.data)
        this._atomMap.set(atom, resolved)
        if (!this._hasCommitEffects && atom.onSet) {
            this._hasCommitEffects = true
        }
        // A set supersedes an unset of the same atom buffered earlier in this txn
        // (last write wins, regardless of order). Symmetric to `unset` dropping
        // any buffered set.
        this._unsetSet?.delete(atom)
        this.invalidateSelectorCache()

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
        return resolved as V
    }

    // @ts-ignore
    batchSetFamilyAtoms = (family, pairs) => {
        if (!this._atomMap.has(family)) {
            // @ts-ignore
            this.cloneFamilyIntoTxn(family)
        }
        this.invalidateSelectorCache()
        const index = this._atomMap.get(family).__index
        for (const [atom, value] of pairs) {
            if (atom.family !== family) {
                throw new Error("Atom does not belong to the provided family")
            }
            index.created.set(atom, performance.now())
            if (index.deleted.has(atom)) index.deleted.delete(atom)
            // Validate like Transaction.set so this path can't become an
            // unvalidated hole (promises are skipped by validateSchema).
            this._atomMap.set(atom, validateSchema(atom, value, this.data))
            if (!this._hasCommitEffects && atom.onSet) {
                this._hasCommitEffects = true
            }
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
        this.invalidateSelectorCache()
    }

    unset = (atom: Atom) => {
        if (!isAtom(atom)) throw new Error("unset() expects an atom.")
        // An unset in the same txn supersedes a set of the same atom — drop any
        // buffered write so the atom reverts (re-inherits on a scope / reverts to
        // its default on a root) rather than being re-written.
        this._atomMap.delete(atom)
        if (!this._unsetSet) this._unsetSet = new Set()
        this._unsetSet.add(atom)
        this.invalidateSelectorCache()
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

    // Generic like ResetAtom so a Transaction is structurally assignable to
    // TransactionInterface (what `InitializeCallback` is typed against).
    reset = <V>(atom: Atom<V>): V | Promise<V> => {
        const value = getAtomInitValue(
            atom,
            this.data,
            this.initializedAtomsSet,
        ) as V | Promise<V>
        this._atomMap.set(atom, value)
        if (!this._hasCommitEffects && atom.onSet) {
            this._hasCommitEffects = true
        }
        // reset writes the default; it supersedes a buffered unset of the atom.
        this._unsetSet?.delete(atom)
        this.invalidateSelectorCache()
        return value
    }

    execute = <Callback extends TransactionFn>(
        callback: Callback,
        autoCommit = true,
    ): ReturnType<Callback> => {
        if (this._selectorRuntime) this._selectorRuntime.readOverlayActive = true
        try {
            const result = callback(this) as ReturnType<Callback>
            if (isPromiseLike(result)) {
                // Do not commit writes staged before the thenable was returned.
                // Observe native Promise rejection to avoid an unhandled rejection.
                if (result instanceof Promise) result.catch(() => {})
                throw new Error("Transaction callbacks must be synchronous")
            }
            if (autoCommit) this.txnCommit()
            return result
        } finally {
            if (this._selectorRuntime) {
                this._selectorRuntime.readOverlayActive = false
            }
        }
    }

    private txnCommit = () => {
        if (this.parentTransaction) {
            this.parentTransaction.txnCommit()
        } else {
            this.commit()
        }
    }

    commit = () => {
        // Commit boundary for store.onCommitEnd: listeners fire once, when the
        // outermost boundary closes — after every subscriber callback and after
        // the onChange flush below. The inner propagation passes also open
        // boundaries (see propagateAtomUpdate's wrapper); nested inside this one
        // they just move the depth counter. With no listener anywhere this is a
        // single counter read, so the Bencher-gated txn hot path is unchanged.
        let commitEndRoot: StoreData | undefined
        if (commitEndRegistry.count !== 0) commitEndRoot = beginCommit(this.data)
        let succeeded = false
        try {
            // When nothing is watching, commit directly — no sink allocation, so
            // the Bencher-gated txn hot path is unchanged.
            if (changeListenerRegistry.count === 0) {
                this.commitWork(undefined)
                succeeded = true
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
            succeeded = true
        } finally {
            // On failure, listener errors are swallowed so they never mask the
            // commit's own error; the writes were applied either way, so
            // listeners still fire.
            if (commitEndRoot) endCommit(commitEndRoot, !succeeded)
        }
    }

    private commitWork = (sink: ChangeSink | undefined) => {
        // Single-store fast path: no scoped transactions to coordinate.
        if (!this._scopedTransactions) {
            const initializedAtomsSet = new Set<Atom>()
            if (!this._unsetSet?.size && !this._deleteSet?.size) {
                setAtoms(
                    this._atomMap,
                    this.data,
                    initializedAtomsSet,
                    false,
                    sink,
                    this._hasCommitEffects,
                )
                return
            }

            // Deletes/unsets require multiple propagation passes. Complete ALL
            // mutations first, then hooks, then every propagation/notification.
            const onSets: DeferredOnSet[] = []
            const updatedAtoms = writeAtoms(
                this._atomMap,
                this.data,
                initializedAtomsSet,
                false,
                onSets,
            )
            const deleted = this._deleteSet?.size
                ? [...this._deleteSet]
                : undefined
            if (this._deleteSet?.size) {
                deleteAtomFamilyAtoms(this._deleteSet, this.data)
            }
            const unsetAtoms = this._unsetSet?.size
                ? this.applyUnsets(this._unsetSet, this.data)
                : []

            const errors = createCommitErrors()
            const globalUpdates = applyGlobalOnSets(onSets, errors)
            runOnSets(onSets, errors)

            const notify: NotifyTarget = new Map()
            const globalSink =
                globalUpdates && globalUpdates.size > 0
                    ? createChangeSink(undefined, "set")
                    : undefined
            const commitRoots = globalSink
                ? beginGlobalCommit(this.data, globalUpdates!)
                : []
            // Global peers historically surface as direct `set` changes and
            // report before the transaction origin.
            if (globalUpdates) {
                for (const [peer, atoms] of globalUpdates) {
                    try {
                        propagateAtomUpdate(
                            atoms,
                            peer,
                            false,
                            notify,
                            globalSink,
                        )
                    } catch (error) {
                        recordCommitError(errors, error)
                    }
                }
            }
            if (updatedAtoms.length > 0) {
                try {
                    propagateAtomUpdate(
                        updatedAtoms,
                        this.data,
                        false,
                        notify,
                        sink,
                    )
                } catch (error) {
                    recordCommitError(errors, error)
                }
            }
            if (deleted) {
                try {
                    propagateDeletedAtoms(
                        deleted,
                        this.data,
                        undefined,
                        undefined,
                        undefined,
                        notify,
                        sink,
                    )
                } catch (error) {
                    recordCommitError(errors, error)
                }
            }
            if (unsetAtoms.length > 0) {
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
                try {
                    propagateAtomUpdate(
                        unsetAtoms,
                        this.data,
                        false,
                        notify,
                        sink,
                        false,
                        false,
                    )
                } catch (error) {
                    recordCommitError(errors, error)
                }
            }
            try {
                notifyDeferred(notify)
            } catch (error) {
                recordCommitError(errors, error)
            }
            if (globalSink) {
                try {
                    flushChangeSink(globalSink)
                } catch (error) {
                    recordCommitError(errors, error)
                }
                endGlobalCommit(commitRoots, errors)
            }
            // Re-delegate AFTER firing: the deferred scope-local callback
            // idempotently drops its delegate, so the fresh parent delegate is
            // established last even when a callback threw.
            for (const atom of unsetAtoms) {
                try {
                    reDelegateScopeSubscriptions(atom, this.data)
                } catch (error) {
                    recordCommitError(errors, error)
                }
            }
            throwCommitError(errors)
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

        const errors = createCommitErrors()

        // Global peers are writes too. Apply them all before entering the hook
        // phase, preserving the root-first hook/fan-out order of the plan.
        let globalUpdates
        for (const entry of plan) {
            globalUpdates = applyGlobalOnSets(
                entry.onSets,
                errors,
                globalUpdates,
            )
        }

        // Every value across the tree and every global peer is now applied.
        // Hooks fire root-first, all are attempted, and their first error is
        // retained until propagation and notification have also completed.
        for (const entry of plan) {
            runOnSets(entry.onSets, errors)
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
        const globalSink =
            globalUpdates && globalUpdates.size > 0
                ? createChangeSink(undefined, "set")
                : undefined
        const commitRoots = globalSink
            ? beginGlobalCommit(this.data, globalUpdates!)
            : []
        // Global fan-out retains its public direct-set metadata and precedes
        // the originating transaction's reports, as it did when fan-out lived
        // inside the global atom's onSet wrapper.
        if (globalUpdates) {
            for (const [data, atoms] of globalUpdates) {
                try {
                    propagateAtomUpdate(
                        atoms,
                        data,
                        false,
                        notify,
                        globalSink,
                    )
                } catch (error) {
                    recordCommitError(errors, error)
                }
            }
        }
        for (const { data, updatedAtoms, deleted, unsetAtoms } of plan) {
            if (updatedAtoms.length > 0) {
                try {
                    propagateAtomUpdate(updatedAtoms, data, false, notify, sink)
                } catch (error) {
                    recordCommitError(errors, error)
                }
            }
            if (deleted) {
                try {
                    propagateDeletedAtoms(
                        deleted,
                        data,
                        undefined,
                        undefined,
                        undefined,
                        notify,
                        sink,
                    )
                } catch (error) {
                    recordCommitError(errors, error)
                }
            }
            if (unsetAtoms && unsetAtoms.length > 0) {
                // Atoms first (emitted as "unset" via reportUnsetAtom), then
                // propagate with reportAtoms=false so dependent-selector recomputes
                // are reported too — without re-surfacing the atom (its value is
                // gone from data.values) as a "set".
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
                try {
                    propagateAtomUpdate(
                        unsetAtoms,
                        data,
                        false,
                        notify,
                        sink,
                        false,
                        false,
                    )
                } catch (error) {
                    recordCommitError(errors, error)
                }
            }
        }
        try {
            notifyDeferred(notify)
        } catch (error) {
            recordCommitError(errors, error)
        }
        if (globalSink) {
            try {
                flushChangeSink(globalSink)
            } catch (error) {
                recordCommitError(errors, error)
            }
            endGlobalCommit(commitRoots, errors)
        }
        // Re-delegate AFTER firing (notifyDeferred): the scope-local callback
        // idempotently drops its delegate when it fires, so the fresh parent
        // delegate must be (re)established last.
        for (const { data, unsetAtoms } of plan) {
            if (unsetAtoms) {
                for (const atom of unsetAtoms) {
                    try {
                        reDelegateScopeSubscriptions(atom, data)
                    } catch (error) {
                        recordCommitError(errors, error)
                    }
                }
            }
        }
        throwCommitError(errors)
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

    private invalidateSelectorCache() {
        if (!this.dirty) this.dirty = true
    }

    private get selectorRuntime(): SelectorEvaluationRuntime {
        if (!this._selectorRuntime) {
            this._selectorRuntime = {
                abortControllers: new Map(),
                latestEvalContext: new Map(),
                stateDependencies: new Map(),
                readOverlayActive: true,
            }
        }
        return this._selectorRuntime
    }

    private get selectorCircularDependencySet() {
        if (!this._selectorCircularDependencySet) {
            this._selectorCircularDependencySet = new WeakSet()
        }
        return this._selectorCircularDependencySet
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
        // A scope that first materializes its OWN family index inside a txn must
        // build a CHILD index — empty created/deleted, linked to the parent via
        // parentIndex — exactly as the non-txn path does in initFamilyIndex. The
        // previous code flat-cloned `this.get(family)`, which for a read-through
        // scope is the PARENT's rendered index: that snapshots every inherited
        // member into the scope's OWN `created` map and drops the parent link, so
        //   (a) recursivelyUpdateIndexes can't reach the scope (it isn't tracked),
        //       and
        //   (b) a later parent delete can't remove the member — the scope's own
        //       `created` copy shadows the parent's tombstone.
        // Both leave the scope's get(family) — and every selector/index() reading
        // it — permanently stale. Registering in scopeValueIndex (trackScopeValue)
        // and keeping the parentIndex link mirrors initFamilyIndex exactly.
        // TRUE first materialization: the scope has no working index for this
        // family yet — neither in this txn (_atomMap) nor committed (data.values).
        // The `!_atomMap.has` guard is essential: cloneFamilyIntoTxn is re-invoked
        // on a scoped txn via the recursion below whenever an ancestor re-clones,
        // and at that point the scope may already hold its own accumulated
        // created/deleted in _atomMap — which must be preserved (cloned), not
        // reset to an empty child index.
        const scopeFirstMaterialization =
            this.data.parent &&
            !this._atomMap.has(family) &&
            !this.data.values.has(family)
        let clonedIndex
        if (scopeFirstMaterialization) {
            // parentIndex is the parent transaction's working clone in a
            // cross-scope txn; for a scope-only txn it's the parent store's
            // committed index, read through via this.get(family).__index.
            // NOTE: the scope is registered in the parent's scopeValueIndex at
            // COMMIT time (setValueInData, when this index is actually written
            // into data.values) — NOT here. Registering during the txn body would
            // leave a dangling scopeValueIndex entry if the txn throws (valdres
            // does not roll back): the scope never gets its index, but the parent
            // would think it shadows the family, and the next parent family write
            // would deref `undefined` in recursivelyUpdateIndexes.
            clonedIndex = createAtomFamilyIndex(
                // @ts-ignore
                parentIndex ?? currentFamilyList.__index,
            )
        } else {
            clonedIndex = cloneAtomFamilyIndex(
                // @ts-ignore
                currentFamilyList.__index,
                parentIndex,
            )
        }
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
