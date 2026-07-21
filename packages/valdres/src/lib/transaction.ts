import type { Atom } from "../types/Atom"
import type { AtomFamily } from "../types/AtomFamily"
import type { AtomFamilyAtom } from "../types/AtomFamilyAtom"
import type { GetValue } from "../types/GetValue"
import type { MutationDraft } from "../types/MutationDraft"
import type { State } from "../types/State"
import type { SetAtomValue } from "../types/SetAtomValue"
import type { StoreData } from "../types/StoreData"
import type { StoreChangeSource } from "../types/StoreChangeSource"
import type { TransactionFn } from "../types/TransactionFn"
import { SchemaValidationError } from "../errors/SchemaValidationError"
import {
    createStoreDisposedError,
    DISPOSED_STORE_PENDING,
    trackStoreTransaction,
    untrackStoreTransaction,
} from "./storeLifecycle"
import type { StoreResources } from "./storeLifecycle"
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
import { normalizeStagedValue } from "./normalizeStagedValue"
import {
    changeListenerRegistry,
    createChangeSink,
    flushChangeSink,
    reportUnsetAtom,
    type ChangeSink,
} from "./notifyChangeListeners"
import { beginCommit, commitEndRegistry, endCommit } from "./onCommitEnd"
import { runCommitPlan } from "./commitEngine"
import {
    createCommitErrors,
    recordCommitError,
    throwCommitError,
    type CommitErrors,
} from "./commitErrors"
import { BULK_WITH_EFFECTS_SILENT } from "./commitIntents"
import {
    applyGlobalOnSets,
    beginGlobalCommit,
    endGlobalCommit,
    type StoreAtomUpdates,
} from "./globalAtomFanOut"
import {
    cloneAtomFamilyIndex,
    createAtomFamilyIndex,
    hasOwnFamilyAtom,
    renderAtomFamilyIndex,
} from "./atomFamilyIndex"
import {
    createMutationDraft,
    draftHasCleanupMutations,
    resetMutationDraft,
} from "./mutationDraft"
import {
    notifyDeferred,
    propagateAtomUpdate,
    propagateDeletedAtoms,
    settleTransactionCommit,
    type NotifyTarget,
} from "./propagateUpdatedAtoms"
import { runOnSets, type DeferredOnSet } from "./runOnSets"
import { commitAtoms, commitHookFreeAtoms } from "./setAtoms"
import { writeAtoms } from "./writeAtoms"
import {
    evaluateSelectorValue,
    type SelectorEvaluationRuntime,
} from "./initSelector"
import { noteStateValueChanged } from "./stateRevisions"

/** One store's slot in a cross-scope commit. Collected root-first; written
 *  leaf-first (see commit) but notified root-first. */
type CommitWrite = {
    txn: TransactionContext
    data: StoreData
    updatedAtoms: Atom[]
    deleted: AtomFamilyAtom<any, any>[] | undefined
    unsetAtoms: Atom[] | undefined
    onSets: DeferredOnSet[]
}

const TRANSACTION_OPEN = 0
const TRANSACTION_COMMITTING = 1
const TRANSACTION_COMMITTED = 2
const TRANSACTION_ABORTED = 3
const TRANSACTION_DISPOSED = 4

type TransactionState =
    | typeof TRANSACTION_OPEN
    | typeof TRANSACTION_COMMITTING
    | typeof TRANSACTION_COMMITTED
    | typeof TRANSACTION_ABORTED
    | typeof TRANSACTION_DISPOSED

/** How a working tree ended without committing: consumer abort (including a
 *  throwing callback) or store disposal. */
type TerminalCancelState =
    | typeof TRANSACTION_ABORTED
    | typeof TRANSACTION_DISPOSED

const transactionStateName = (state: TransactionState) =>
    state === TRANSACTION_OPEN
        ? "open"
        : state === TRANSACTION_COMMITTING
          ? "committing"
          : // Committed, aborted, and disposed are tracked distinctly for
            // lifecycle ownership, but every terminal handle reports the
            // historical "closed" so misuse errors stay byte-identical.
            "closed"

const throwTransactionStateError = (
    state: TransactionState,
    operation: string,
): never => {
    throw new Error(
        `Cannot ${operation} transaction while it is ${transactionStateName(state)}`,
    )
}

// Lifecycle controls are symbol-named so the object handed to a store.txn
// callback has no runtime `commit`, `abort`, `execute`, or `data` escape hatch.
// The adapter-only controller below this package boundary invokes them through
// the module helpers exported at the end of this file.
const EXECUTE_TRANSACTION = Symbol("executeTransaction")
const COMMIT_TRANSACTION = Symbol("commitTransaction")
const ABORT_TRANSACTION = Symbol("abortTransaction")
const CANCEL_TRANSACTION = Symbol("cancelTransaction")

const deleteAtomFamilyAtoms = (
    set: Set<AtomFamilyAtom<any, any>>,
    data: StoreData,
) => {
    set.forEach(atom => {
        if (data.values.delete(atom)) {
            noteStateValueChanged(atom, data)
        }
    })
}

// Detach the own value + bookkeeping for each unset atom that actually had
// one; returns those atoms so the commit can propagate and report them.
// Called in the write phase so every store's values are final before any
// propagation pass runs.
const applyUnsets = (unsetSet: Set<Atom>, data: StoreData): Atom[] => {
    const unsetAtoms: Atom[] = []
    for (const atom of unsetSet) {
        if (detachOwnValue(atom, data)) unsetAtoms.push(atom)
    }
    return unsetAtoms
}


export class TransactionContext {
    private readonly _data: StoreData
    private _parentTransaction: TransactionContext | undefined
    private readonly _name: string | undefined
    private _state: TransactionState = TRANSACTION_OPEN
    private _scopedTransactions: undefined | Map<string, TransactionContext>
    // Everything this level stages before commit lives in one write overlay —
    // see MutationDraft. The context itself keeps only lifecycle and tree
    // structure, so staging can be read independently from commit execution.
    private readonly _draft: MutationDraft
    private _lifecycleResources: StoreResources | undefined
    constructor(
        data: StoreData,
        parentTransaction?: TransactionContext,
        childTransaction?: TransactionContext,
        name?: string,
    ) {
        this._data = data
        this._parentTransaction = parentTransaction
        this._name = name
        this._draft = createMutationDraft()
        if (childTransaction) {
            this._scopedTransactions = new Map([
                [childTransaction._data.id, childTransaction],
            ])
        }
        this._lifecycleResources = trackStoreTransaction(data, this)
        if (!this._lifecycleResources) this.cancelTree(TRANSACTION_DISPOSED)
    }

    private assertOpen(operation: string): void {
        // Keep the active path identical to the transaction state guard: store
        // disposal closes every registered open context through cancelTree().
        // Only a terminal handle pays the extra lifecycle read, which also lets
        // a retained, previously committed handle report disposal precisely.
        if (this._state === TRANSACTION_OPEN) return
        if (this._data.pendingOrphanCleanup === DISPOSED_STORE_PENDING) {
            throw createStoreDisposedError(this._data)
        }
        throwTransactionStateError(this._state, operation)
    }

    /** Close a working tree and release resources that were never committed.
     *  `terminal` records why: consumer abort or store disposal. */
    private cancelTree(terminal: TerminalCancelState): void {
        this._state = terminal
        this.untrackLifecycle()
        if (this._scopedTransactions) {
            for (const transaction of this._scopedTransactions.values()) {
                transaction.cancelTree(terminal)
            }
            this._scopedTransactions.clear()
        }
        resetMutationDraft(this._draft)
    }

    private untrackLifecycle(): void {
        const resources = this._lifecycleResources
        if (!resources) return
        this._lifecycleResources = undefined
        untrackStoreTransaction(resources, this)
    }

    private untrackTree(): void {
        this.untrackLifecycle()
        if (!this._scopedTransactions) return
        for (const transaction of this._scopedTransactions.values()) {
            transaction.untrackTree()
        }
    }

    /** Disposal-only cancellation: idempotent and valid after terminal mark. */
    [CANCEL_TRANSACTION](): void {
        const root = this._parentTransaction ? this.rootTransaction() : this
        root.cancelTree(TRANSACTION_DISPOSED)
    }

    private hasTxnOrData = (state: State): boolean => {
        const draft = this._draft
        if (draft.values.has(state)) return true
        // An unset buffered at this level (and not superseded by a later set)
        // makes this scope provide no value: the committed shadow still sits in
        // this._data.values until commit, so we must NOT read it — fall through
        // to a parent transaction, or report "not here" so `get` reads through
        // the committed parent chain.
        if (draft.unsets?.has(state)) {
            return this._parentTransaction
                ? this._parentTransaction.hasTxnOrData(state)
                : false
        }
        if (this._data.values.has(state)) return true
        if (this._parentTransaction)
            return this._parentTransaction.hasTxnOrData(state)
        return false
    }

    private valueFromTxnOrData: GetValue = (state: State) => {
        const draft = this._draft
        if (draft.values.has(state)) {
            return draft.values.get(state)
        }
        if (draft.unsets?.has(state)) {
            return this._parentTransaction
                ? this._parentTransaction.valueFromTxnOrData(state)
                : undefined
        }
        if (this._data.values.has(state)) {
            return this._data.values.get(state)
        }
        if (this._parentTransaction) {
            return this._parentTransaction.valueFromTxnOrData(state)
        }
    }

    get: GetValue = (state: State<any>) => {
        this.assertOpen("read from")
        if (isAtom(state) || isAtomFamily(state)) {
            if (this.hasTxnOrData(state)) {
                const value = this.valueFromTxnOrData(state)
                if (isAtomFamily(state) && value?.__index) {
                    // Membership writes leave the working index dirty so a run
                    // of txn.set calls pays for one copy + sort, not one per
                    // staged member. A transaction read is an observation
                    // boundary, so materialize the latest membership here.
                    const rendered = renderAtomFamilyIndex(value.__index)
                    if (
                        this._draft.values.get(state) === value &&
                        rendered !== value
                    ) {
                        this._draft.values.set(state, rendered)
                        this._draft.dirtyFamilyIndexes?.delete(state)
                        if (this._draft.dirtyFamilyIndexes?.size === 0) {
                            this._draft.dirtyFamilyIndexes = undefined
                        }
                    }
                    return rendered
                }
                return value
            }
            // No txn level provides a value. If this level unset the atom, its
            // committed value is still in this._data.values until commit, so we
            // must NOT read it: read through the parent chain (scope) or compute
            // the atom's default (root) instead.
            if (this._draft.unsets?.has(state)) {
                return this._data.parent
                    ? getState(
                          state,
                          this._data.parent,
                          this.initializedAtomsSet,
                      )
                    : getAtomInitValue(
                          state as Atom,
                          this._data,
                          this.initializedAtomsSet,
                      )
            }
            return getState(state, this._data, this.initializedAtomsSet)
        } else if (isSelector(state)) {
            if (this._draft.dirty) {
                this.selectorCache.clear()
                this._draft.dirty = false
            } else if (this.selectorCache.has(state)) {
                // If the selector is cached and not dirty, return the cached value
                return this.selectorCache.get(state)
            }

            const res = evaluateSelectorValue(
                state,
                this._data,
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
        this.assertOpen("write to")
        if (!isAtom(atom)) throw new Error("Not an atom")
        let resolved: V | PromiseLike<V>
        if (isFunction(value)) {
            const currentValue = this.get(atom) as V
            resolved = value(currentValue)
        } else {
            resolved = value
        }

        // Staging-time freeze + validation (see normalizeStagedValue): a schema
        // failure throws inside the user's callback, so commit never runs and
        // the transaction stays atomic. This also covers stores using implicit
        // batched txns.
        resolved = normalizeStagedValue(atom, resolved, this._data)
        // One draft load for the whole staging body: bulk staging loops (5k+
        // member updates) are Bencher-gated, so keep the per-set load profile
        // identical to the historical direct fields.
        const draft = this._draft
        draft.values.set(atom, resolved)
        if (!draft.hasCommitEffects && atom.onSet) {
            draft.hasCommitEffects = true
        }
        // A set supersedes an unset of the same atom buffered earlier in this txn
        // (last write wins, regardless of order). Symmetric to `unset` dropping
        // any buffered set.
        draft.unsets?.delete(atom)
        if (!draft.dirty) draft.dirty = true
        if (isFamilyAtom(atom)) {
            const ownFamilyValue = draft.values.has(atom.family)
                ? draft.values.get(atom.family)
                : this._data.values.has(atom.family)
                  ? this._data.values.get(atom.family)
                  : undefined
            // A root (or already-materialized scope) that already owns this
            // member needs no family-index write at all. An inherited scoped
            // member intentionally falls through: the scope must claim local
            // ownership so it survives a later parent deletion.
            if (
                !ownFamilyValue?.__index ||
                !hasOwnFamilyAtom(ownFamilyValue.__index, atom)
            ) {
                if (!draft.values.has(atom.family)) {
                    // @ts-ignore
                    this.cloneFamilyIntoTxn(atom.family)
                }
                const index = draft.values.get(atom.family).__index
                index.created.set(atom, performance.now())
                index.deleted.delete(atom)
                this.recursivelyUpdateAtomFamilyIndexes(atom.family)
            }
        }
        return resolved as V
    }

    batchSetFamilyAtoms = (
        family: any,
        pairs: any,
        onSchemaError:
            | ((error: SchemaValidationError) => void)
            | undefined = undefined,
    ) => {
        this.assertOpen("write to")
        // One draft load for the whole bulk loop (see Transaction.set).
        const draft = this._draft
        let ownFamilyValue = draft.values.has(family)
            ? draft.values.get(family)
            : this._data.values.has(family)
              ? this._data.values.get(family)
              : undefined
        let index = ownFamilyValue?.__index
        let membershipChanged = false
        let staged = false
        for (const [atom, value] of pairs) {
            if (atom.family !== family) {
                throw new Error("Atom does not belong to the provided family")
            }
            let resolved = value
            // Freeze + validate like Transaction.set (normalizeStagedValue) so
            // this public bulk path cannot be used to bypass a store's schema
            // boundary. Hydrate's lenient mode supplies a per-entry handler so
            // invalid members can be skipped without giving up one grouped
            // write per family.
            if (!onSchemaError) {
                resolved = normalizeStagedValue(atom, resolved, this._data)
            } else {
                try {
                    resolved = normalizeStagedValue(atom, resolved, this._data)
                } catch (error) {
                    if (!(error instanceof SchemaValidationError)) throw error
                    onSchemaError(error)
                    continue
                }
            }
            draft.values.set(atom, resolved)
            if (!staged) {
                staged = true
                if (!draft.dirty) draft.dirty = true
            }
            if (!draft.hasCommitEffects && atom.onSet) {
                draft.hasCommitEffects = true
            }
            draft.unsets?.delete(atom)

            if (!index || !hasOwnFamilyAtom(index, atom)) {
                if (!draft.values.has(family)) {
                    // @ts-ignore
                    this.cloneFamilyIntoTxn(family)
                    ownFamilyValue = draft.values.get(family)
                    index = ownFamilyValue.__index
                }
                index.created.set(atom, performance.now())
                index.deleted.delete(atom)
                membershipChanged = true
            }
        }
        if (membershipChanged) {
            this.recursivelyUpdateAtomFamilyIndexes(family)
        }
    }

    del = (atom: AtomFamilyAtom<any, any>) => {
        this.assertOpen("write to")
        if (!this._draft.values.has(atom.family)) {
            // @ts-ignore
            this.cloneFamilyIntoTxn(atom.family)
        }
        const index = this._draft.values.get(atom.family).__index
        index.created.delete(atom)
        index.deleted.set(atom, performance.now())
        this.recursivelyUpdateAtomFamilyIndexes(atom.family)
        if (this._data.values.has(atom)) {
            this.deleteSet.add(atom)
        }
        if (this._draft.values.has(atom)) {
            this._draft.values.delete(atom)
        }
        this.invalidateSelectorCache()
    }

    unset = (atom: Atom) => {
        this.assertOpen("write to")
        if (!isAtom(atom)) throw new Error("unset() expects an atom.")
        // An unset in the same txn supersedes a set of the same atom — drop any
        // buffered write so the atom reverts (re-inherits on a scope / reverts to
        // its default on a root) rather than being re-written.
        this._draft.values.delete(atom)
        if (!this._draft.unsets) this._draft.unsets = new Set()
        this._draft.unsets.add(atom)
        this.invalidateSelectorCache()
    }

    scope = <Callback extends TransactionFn>(
        scopeId: string,
        callback: Callback,
    ): ReturnType<Callback> => {
        this.assertOpen("open a scope on")
        if (this._data.scopes.has(scopeId)) {
            return this.scopedTransaction(scopeId)[EXECUTE_TRANSACTION](
                callback,
                false,
            )
        } else {
            throw new Error(
                `Scope '${scopeId}' not found. Registered scopes: ${[...this._data.scopes.keys()].join(", ")}`,
            )
        }
    }

    parentScope = <Callback extends TransactionFn>(
        callback: Callback,
    ): ReturnType<Callback> => {
        this.assertOpen("open a parent scope on")
        if (!this._parentTransaction) {
            if (!this._data.parent) {
                throw new Error("Cannot access parentScope on root store")
            }
            this._parentTransaction = new TransactionContext(
                this._data.parent,
                undefined,
                this,
            )
        }
        return this._parentTransaction[EXECUTE_TRANSACTION](callback, false)
    }

    reset = <V>(atom: Atom<V>): V | Promise<V> => {
        this.assertOpen("write to")
        const value = getAtomInitValue(
            atom,
            this._data,
            this.initializedAtomsSet,
        ) as V | Promise<V>
        this._draft.values.set(atom, value)
        if (!this._draft.hasCommitEffects && atom.onSet) {
            this._draft.hasCommitEffects = true
        }
        // reset writes the default; it supersedes a buffered unset of the atom.
        this._draft.unsets?.delete(atom)
        this.invalidateSelectorCache()
        return value
    };

    [EXECUTE_TRANSACTION]<Callback extends TransactionFn>(
        callback: Callback,
        autoCommit = true,
    ): ReturnType<Callback> {
        this.assertOpen("execute")
        if (this._draft.selectorRuntime)
            this._draft.selectorRuntime.readOverlayActive = true
        try {
            const result = callback(this) as ReturnType<Callback>
            if (isPromiseLike(result)) {
                // Do not commit writes staged before the thenable was returned.
                // Observe native Promise rejection to avoid an unhandled rejection.
                if (result instanceof Promise) result.catch(() => {})
                throw new Error("Transaction callbacks must be synchronous")
            }
            if (autoCommit) this[COMMIT_TRANSACTION]()
            return result
        } catch (error) {
            // Only the outer store.txn owns the lifecycle. Nested scope
            // callbacks share its working tree and let the outer callback
            // decide whether a caught nested error should abort its own work.
            const root = this._parentTransaction ? this.rootTransaction() : this
            if (autoCommit && root._state === TRANSACTION_OPEN) {
                // Preserve the callback error even if it disposed the store.
                // This internal cancellation intentionally bypasses the public
                // lifecycle assertion while still draining speculative work.
                root.cancelTree(TRANSACTION_ABORTED)
            }
            throw error
        } finally {
            if (this._draft.selectorRuntime) {
                this._draft.selectorRuntime.readOverlayActive = false
            }
        }
    }

    [COMMIT_TRANSACTION](source?: StoreChangeSource): void {
        const root = this._parentTransaction ? this.rootTransaction() : this
        root.assertOpen("commit")
        // The overwhelmingly common single-store path changes two scalar
        // fields and never calls or allocates a tree helper. Cross-scope
        // transactions validate every child before changing any state.
        if (root._scopedTransactions) {
            root.assertScopedTreeOpen("commit")
            root.setScopedTreeState(TRANSACTION_COMMITTING)
        }
        root._state = TRANSACTION_COMMITTING
        try {
            root.commitOpenTransaction(source)
        } finally {
            // Terminal mark only: a committed tree keeps its (already applied)
            // staging state, exactly as the historical fields did — retained
            // handles may still be inspected, and in-flight speculative async
            // selector work settles through the overlay runtime.
            root._state = TRANSACTION_COMMITTED
            if (root._scopedTransactions) {
                root.setScopedTreeState(TRANSACTION_COMMITTED)
            }
            root.untrackTree()
        }
    }

    [ABORT_TRANSACTION](): void {
        const root = this._parentTransaction ? this.rootTransaction() : this
        root.assertOpen("abort")
        if (root._scopedTransactions) {
            root.assertScopedTreeOpen("abort")
        }
        root.cancelTree(TRANSACTION_ABORTED)
    }

    private rootTransaction(): TransactionContext {
        return this._parentTransaction
            ? this._parentTransaction.rootTransaction()
            : this
    }

    private assertScopedTreeOpen(operation: string): void {
        if (this._scopedTransactions) {
            for (const [, scopedTxn] of this._scopedTransactions) {
                scopedTxn.assertOpen(operation)
                scopedTxn.assertScopedTreeOpen(operation)
            }
        }
    }

    private setScopedTreeState(state: TransactionState): void {
        if (this._scopedTransactions) {
            for (const [, scopedTxn] of this._scopedTransactions) {
                scopedTxn._state = state
                scopedTxn.setScopedTreeState(state)
            }
        }
    }

    private commitOpenTransaction(source?: StoreChangeSource): void {
        // The ordinary single-store arm — no hooks (and therefore no globals:
        // every global atom carries a marker onSet) and no cleanup mutations —
        // translates its whole commit into one CommitPlan that owns the outer
        // commit-end boundary and the deferred onChange flush. The remaining
        // arms share their write phase with the unmigrated global fan-out
        // adapter, whose branch is only known after that phase, so their outer
        // boundary and flush stay below until the cross-scope/global migration.
        if (
            !this._scopedTransactions &&
            !this._draft.hasCommitEffects &&
            !draftHasCleanupMutations(this._draft)
        ) {
            // Staging materialization only (one copy + sort per dirty family
            // working index) — unobservable, so it may precede the boundary.
            this.renderDirtyAtomFamilyIndexes()
            // With no listener anywhere no sink is allocated, so the
            // Bencher-gated txn hot path keeps its shape.
            const sink =
                changeListenerRegistry.count === 0
                    ? undefined
                    : createChangeSink(this._name, source)
            commitHookFreeAtoms(
                this._draft.values,
                this._data,
                new Set<Atom>(),
                sink,
            )
            return
        }
        // Commit boundary for store.onCommitEnd: listeners fire once, when the
        // outermost boundary closes — after every subscriber callback and after
        // the onChange flush below. The inner propagation passes also open
        // boundaries (see propagateAtomUpdate's wrapper); nested inside this one
        // they just move the depth counter. With no listener anywhere this is a
        // single counter read, so the Bencher-gated txn hot path is unchanged.
        let commitEndRoot: StoreData | undefined
        if (commitEndRegistry.count !== 0)
            commitEndRoot = beginCommit(this._data)
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
            const sink = createChangeSink(this._name, source)
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
        // Single-store path: no scoped transactions to coordinate. Translate
        // the finalized overlay into the commit engine — the bulk coordinator,
        // or a CommitPlan for cleanup mutations. (The hook-free arm committed
        // its own plan from commitOpenTransaction.) Only global peer fan-out
        // stays on its legacy adapter (see below).
        if (!this._scopedTransactions) {
            this.renderDirtyAtomFamilyIndexes()
            const draft = this._draft
            // Commit-scoped initialization set — deliberately NOT the draft's
            // body-read set: atoms lazily initialized while the callback ran
            // must not be re-propagated by the write phase.
            const initializedAtomsSet = new Set<Atom>()
            if (!draftHasCleanupMutations(draft)) {
                commitAtoms(
                    draft.values,
                    this._data,
                    initializedAtomsSet,
                    sink
                        ? { onSet: "collect", report: sink }
                        : BULK_WITH_EFFECTS_SILENT,
                )
                return
            }

            // Cleanup commit: deletes/unsets require multiple propagation
            // passes. Complete ALL mutations first (phases 1–2 inline), then
            // hand the plan to the engine for hooks, settlement, cleanup
            // ordering, and error arbitration.
            const onSets: DeferredOnSet[] = []
            const updatedAtoms = writeAtoms(
                draft.values,
                this._data,
                initializedAtomsSet,
                false,
                onSets,
            )
            const deleted = draft.deletes?.size
                ? [...draft.deletes]
                : undefined
            if (draft.deletes?.size) {
                deleteAtomFamilyAtoms(draft.deletes, this._data)
            }
            const unsetAtoms = draft.unsets?.size
                ? applyUnsets(draft.unsets, this._data)
                : []

            const errors = createCommitErrors()
            // Global peers are writes too: apply them all while still in the
            // write phase. An empty map means every peer was value-equal — a
            // local plan handles that exactly like no globals at all.
            const globalUpdates = applyGlobalOnSets(onSets, errors)
            if (globalUpdates && globalUpdates.size > 0) {
                // Hooks fire after every local and peer write, before any
                // propagation — same order the plan path gets from the engine.
                runOnSets(onSets, errors)
                this.commitCleanupWithGlobalFanOut(
                    updatedAtoms,
                    deleted,
                    unsetAtoms,
                    sink,
                    errors,
                    globalUpdates,
                )
                return
            }

            runCommitPlan({
                data: this._data,
                settlement: {
                    kind: "transaction",
                    atoms: updatedAtoms,
                    deleted,
                    unset: unsetAtoms.length > 0 ? unsetAtoms : undefined,
                    settle: settleTransactionCommit,
                },
                onSets,
                errors,
                report: sink,
                // continueAfterError stays default: a hook error must not
                // starve settlement of already-applied writes.
            })
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
            txn.renderDirtyAtomFamilyIndexes()
            entry.updatedAtoms = writeAtoms(
                txn._draft.values,
                entry.data,
                new Set<Atom>(),
                false,
                entry.onSets,
            )
            if (txn._draft.deletes?.size) {
                deleteAtomFamilyAtoms(txn._draft.deletes, entry.data)
                entry.deleted = [...txn._draft.deletes]
            }
            if (txn._draft.unsets?.size) {
                // Detach shadows in the write phase so every store's values are
                // final before any propagation pass reads through the chain.
                entry.unsetAtoms = applyUnsets(txn._draft.unsets, entry.data)
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
            ? beginGlobalCommit(this._data, globalUpdates!)
            : []
        // Global fan-out retains its public direct-set metadata and precedes
        // the originating transaction's reports, as it did when fan-out lived
        // inside the global atom's onSet wrapper.
        if (globalUpdates) {
            for (const [data, atoms] of globalUpdates) {
                try {
                    propagateAtomUpdate(atoms, data, false, notify, globalSink)
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

    /**
     * LEGACY GLOBAL FAN-OUT ADAPTER (unmigrated). A single-store cleanup
     * commit whose staged writes changed at least one global peer settles the
     * whole multi-store unit here instead of through a CommitPlan: every
     * store's selectors settle before any subscriber fires, and no store's
     * error starves a later store. Callers have already applied every local
     * and peer value and run the deferred hooks. Global write planning moves
     * onto the engine with the cross-scope migration.
     */
    private commitCleanupWithGlobalFanOut(
        updatedAtoms: Atom[],
        deleted: AtomFamilyAtom<any, any>[] | undefined,
        unsetAtoms: Atom[],
        sink: ChangeSink | undefined,
        errors: CommitErrors,
        globalUpdates: StoreAtomUpdates,
    ): void {
        const notify: NotifyTarget = new Map()
        const globalSink = createChangeSink(undefined, "set")
        const commitRoots = beginGlobalCommit(this._data, globalUpdates)
        // Global peers historically surface as direct `set` changes and
        // report before the transaction origin.
        for (const [peer, atoms] of globalUpdates) {
            try {
                propagateAtomUpdate(atoms, peer, false, notify, globalSink)
            } catch (error) {
                recordCommitError(errors, error)
            }
        }
        if (updatedAtoms.length > 0) {
            try {
                propagateAtomUpdate(
                    updatedAtoms,
                    this._data,
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
                    this._data,
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
                        this._data,
                        effectiveValueAfterUnset(atom, this._data),
                        sink,
                    )
                }
            }
            try {
                propagateAtomUpdate(
                    unsetAtoms,
                    this._data,
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
        try {
            flushChangeSink(globalSink)
        } catch (error) {
            recordCommitError(errors, error)
        }
        endGlobalCommit(commitRoots, errors)
        // Re-delegate AFTER firing: the deferred scope-local callback
        // idempotently drops its delegate, so the fresh parent delegate is
        // established last even when a callback threw.
        for (const atom of unsetAtoms) {
            try {
                reDelegateScopeSubscriptions(atom, this._data)
            } catch (error) {
                recordCommitError(errors, error)
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
            data: this._data,
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
        if (!this._draft.selectorCache) this._draft.selectorCache = new Map()
        return this._draft.selectorCache
    }

    private invalidateSelectorCache() {
        if (!this._draft.dirty) this._draft.dirty = true
    }

    private get selectorRuntime(): SelectorEvaluationRuntime {
        if (!this._draft.selectorRuntime) {
            this._draft.selectorRuntime = {
                abortControllers: new Map(),
                latestEvalContext: new Map(),
                stateDependencies: new Map(),
                readOverlayActive: true,
            }
        }
        return this._draft.selectorRuntime
    }

    private get selectorCircularDependencySet() {
        if (!this._draft.selectorCircularDependencies) {
            this._draft.selectorCircularDependencies = new WeakSet()
        }
        return this._draft.selectorCircularDependencies
    }
    private get deleteSet() {
        if (!this._draft.deletes) this._draft.deletes = new Set()
        return this._draft.deletes
    }

    private get initializedAtomsSet() {
        if (!this._draft.initializedAtoms) {
            this._draft.initializedAtoms = new Set()
        }
        return this._draft.initializedAtoms
    }

    private scopedTransaction(scopeId: string) {
        if (!this._scopedTransactions) this._scopedTransactions = new Map()
        if (!this._scopedTransactions.has(scopeId)) {
            const scopedData = this._data.scopes.get(scopeId)!
            const scopedTransaction = new TransactionContext(scopedData, this)
            this._scopedTransactions.set(scopeId, scopedTransaction)
        }
        return this._scopedTransactions.get(scopeId)!
    }

    private cloneFamilyIntoTxn(
        family: any,
        // @ts-ignore
        parentIndex,
        moveUpIfParent = true,
    ): void {
        if (moveUpIfParent && this._parentTransaction)
            return this._parentTransaction.cloneFamilyIntoTxn(
                family,
                parentIndex,
                moveUpIfParent,
            )
        const currentFamilyIndex = this._draft.values.has(family)
            ? this._draft.values.get(family).__index
            : this._data.values.has(family)
              ? this._data.values.get(family).__index
              : (this.get(family) as any).__index
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
        // family yet — neither staged in this txn's draft nor committed
        // (data.values). The `!draft.values.has` guard is essential:
        // cloneFamilyIntoTxn is re-invoked on a scoped txn via the recursion
        // below whenever an ancestor re-clones, and at that point the scope may
        // already hold its own accumulated created/deleted in its draft — which
        // must be preserved (cloned), not reset to an empty child index.
        const scopeFirstMaterialization =
            this._data.parent &&
            !this._draft.values.has(family) &&
            !this._data.values.has(family)
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
                parentIndex ?? currentFamilyIndex,
            )
        } else {
            clonedIndex = cloneAtomFamilyIndex(
                // @ts-ignore
                currentFamilyIndex,
                parentIndex,
            )
        }
        if (this._scopedTransactions?.size) {
            for (const [, scopedTxn] of this._scopedTransactions) {
                scopedTxn.cloneFamilyIntoTxn(family, clonedIndex, false)
            }
        }
        // The array is only a carrier for the working index. `get` and commit
        // replace it with a rendered value at their observation boundaries.
        // Avoiding a render here means a membership-changing transaction sorts
        // once, after all staged changes, rather than once before and after.
        const unrenderedFamilyValue: any[] = []
        // @ts-ignore
        unrenderedFamilyValue.__index = clonedIndex
        this._draft.values.set(family, unrenderedFamilyValue)
        this.markAtomFamilyIndexDirty(family)
    }

    private recursivelyUpdateAtomFamilyIndexes(
        atomFamily: AtomFamily<any, any>,
    ) {
        this.markAtomFamilyIndexDirty(atomFamily)

        if (this._scopedTransactions?.size) {
            for (const [, scopedTxn] of this._scopedTransactions) {
                scopedTxn.recursivelyUpdateAtomFamilyIndexes(atomFamily)
            }
        }
    }

    private markAtomFamilyIndexDirty(atomFamily: AtomFamily<any, any>) {
        const currentIndex = this._draft.values.get(atomFamily).__index
        currentIndex.rendered = null
        currentIndex.renderedArray = null
        if (!this._draft.dirtyFamilyIndexes) {
            this._draft.dirtyFamilyIndexes = new Set()
        }
        this._draft.dirtyFamilyIndexes.add(atomFamily)
    }

    /** Materialize every dirty family working index immediately before this
     *  transaction writes. Updating a Map value does not disturb insertion
     *  order, so atom/family propagation order remains unchanged. */
    private renderDirtyAtomFamilyIndexes() {
        const dirtyFamilyIndexes = this._draft.dirtyFamilyIndexes
        if (!dirtyFamilyIndexes) return
        for (const state of dirtyFamilyIndexes) {
            const value = this._draft.values.get(state)
            const rendered = renderAtomFamilyIndex(value.__index)
            if (rendered !== value) this._draft.values.set(state, rendered)
        }
        this._draft.dirtyFamilyIndexes = undefined
    }
}

/** Adapter-internal lifecycle control. Public store.txn callbacks never receive
 *  a context with a named commit method. */
export const commitTransaction = (
    txn: TransactionContext,
    source?: StoreChangeSource,
): void => txn[COMMIT_TRANSACTION](source)

/** Adapter-internal rollback for manually controlled contexts. */
export const abortTransaction = (txn: TransactionContext): void =>
    txn[ABORT_TRANSACTION]()

/** Store-lifecycle cancellation. Unlike a consumer abort, disposal has already
 *  marked the store terminal, so this path deliberately bypasses assertions. */
export const cancelTransaction = (txn: TransactionContext): void =>
    txn[CANCEL_TRANSACTION]()

export const transaction = (
    callback: TransactionFn,
    data: StoreData,
    name?: string,
) => {
    const txn = new TransactionContext(data, undefined, undefined, name)
    return txn[EXECUTE_TRANSACTION](callback)
}
