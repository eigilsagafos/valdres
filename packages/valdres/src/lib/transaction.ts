import type { Atom } from "../types/Atom"
import type { NonEmpty } from "../types/NonEmpty"
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
    trackStoreCancellable,
    untrackStoreCancellable,
} from "./storeLifecycle"
import { CANCEL_ON_STORE_DISPOSE } from "./storeCancellableKey"
import { isAtom } from "../utils/isAtom"
import { isAtomFamily } from "../utils/isAtomFamily"
import { isFamilyAtom } from "../utils/isFamilyAtom"
import { isPromiseLike } from "../utils/isPromiseLike"
import { isSelector } from "../utils/isSelector"
import { clearSupersededAsyncAtomCoordinator } from "./asyncAtomCoordinatorRegistry"
import { detachOwnValue } from "./unsetValue"
import { getState, isAtomDeletedInFamilyIndex } from "./getState"
import { getAtomInitValue } from "./initAtom"
import { isFunction } from "./isFunction"
import { normalizeStagedValue } from "./normalizeStagedValue"
import {
    changeListenerRegistry,
    createChangeSink,
    flushChangeSink,
    type ChangeSink,
} from "./notifyChangeListeners"
import { beginCommit, commitEndRegistry, endCommit } from "./onCommitEnd"
import type { StoreTreeRuntime } from "./storeTreeRuntime"
import { runCommitPlan } from "./commitEngine"
import { createCommitErrors } from "./commitErrors"
import {
    forestSettlement,
    globalEffects,
    singleStoreForest,
    workGroup,
} from "./commitPlans"
import { BULK_WITH_EFFECTS_SILENT } from "./commitIntents"
import {
    applyGlobalSets,
    collectGlobalOnSets,
    type DeferredGlobalSet,
} from "./globalAtomFanOut"
import {
    addFamilyAtomsToSet,
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
import { settleCommitForest } from "./propagateUpdatedAtoms"
import type { CommitForestEntry } from "../types/CommitForestSettleFn"
import type { DeferredOnSet } from "./runOnSets"
import { commitAtoms, commitHookFreeAtoms } from "./setAtoms"
import { writeAtoms } from "./writeAtoms"
import {
    evaluateSelectorValue,
    type SelectorEvaluationRuntime,
} from "./initSelector"
import { noteStateValueChanged } from "./stateRevisions"

/** One store's slot in a cross-scope commit. Collected root-first; written
 *  leaf-first (see commit) but settled root-first. Extends the settlement's
 *  entry shape structurally so the finalized array is handed to the tree
 *  CommitPlan zero-copy; `children` links direct scoped entries so the
 *  settlement walk visits plan stores without reconstructing the tree. */
type CommitWrite = CommitForestEntry & {
    txn: TransactionContext
    children: CommitWrite[] | undefined
    onSets: DeferredOnSet[]
}

/** One store's read-only lazily-initialized family members, settled init-only
 *  after the commit's write phase so their family/member subscribers fire once —
 *  the notification a direct read performs. Membership itself already landed
 *  with the commit (see stageLazyFamilyMemberships). */
type LazyInitSettle = { data: StoreData; atoms: Atom[] }

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
const TRANSACTION_FOR_STORE = Symbol("transactionForStore")
const TRANSACTION_IS_OPEN = Symbol("transactionIsOpen")

const deleteAtomFamilyAtoms = (
    set: Set<AtomFamilyAtom<any, any>>,
    data: StoreData,
) => {
    set.forEach(atom => {
        clearSupersededAsyncAtomCoordinator(atom, data)
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
    /** Implicit microtask batches share a tree for reads/commit, but disposing
     *  one scope cancels only that scope's branch. Explicit transactions remain
     *  atomic across their entire user-authored tree. */
    private readonly _implicitBatch: boolean
    private _state: TransactionState = TRANSACTION_OPEN
    private _scopedTransactions: undefined | Map<string, TransactionContext>
    // Everything this level stages before commit lives in one write overlay —
    // see MutationDraft. The context itself keeps only lifecycle and tree
    // structure, so staging can be read independently from commit execution.
    private readonly _draft: MutationDraft
    /** True while this context is registered with its store's resource ledger
     *  as a cancel-on-dispose entry. */
    private _lifecycleTracked = false
    constructor(
        data: StoreData,
        parentTransaction?: TransactionContext,
        childTransaction?: TransactionContext,
        name?: string,
        implicitBatch = false,
    ) {
        this._data = data
        this._parentTransaction = parentTransaction
        this._name = name
        this._implicitBatch = implicitBatch
        this._draft = createMutationDraft()
        if (childTransaction) {
            this._scopedTransactions = new Map([
                [childTransaction._data.id, childTransaction],
            ])
        }
        this._lifecycleTracked = trackStoreCancellable(data, this)
        if (!this._lifecycleTracked) this.cancelTree(TRANSACTION_DISPOSED)
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

    [TRANSACTION_IS_OPEN](): boolean {
        return this._state === TRANSACTION_OPEN
    }

    /** Close a working tree and release resources that were never committed.
     *  `terminal` records why: consumer abort or store disposal.
     *
     *  A consumer abort does not roll back reads: any family member a body read
     *  lazily initialized already wrote its default into committed data.values,
     *  so it must be registered in the committed family index — otherwise it
     *  holds a value while being absent from get(family), and every selector over
     *  that membership stays permanently stale. The draft (which holds the
     *  working index) is discarded here, so those members settle straight into
     *  committed data with the direct read's own init-only settlement.
     *
     *  The whole tree is marked terminal and its members COLLECTED first, then
     *  settled behind ONE boundary with ONE deferred notification phase. That
     *  ordering is the contract: no callback can reach a still-open context (or
     *  lazily read another member into a snapshot already taken), every store's
     *  membership is final before the first callback runs (so a root subscriber
     *  never observes a scope as empty), and onCommitEnd fires once for the tree
     *  rather than once per context. Skipped on store disposal — nothing reads
     *  the store again. */
    private cancelTree(terminal: TerminalCancelState): void {
        const settles =
            terminal === TRANSACTION_ABORTED
                ? this.collectAbortedLazyMembers()
                : undefined
        this.markTreeCancelled(terminal)
        if (settles) this.settleAbortedLazyMembers(settles)
    }

    /** Terminal mark + resource release for the whole working tree. */
    private markTreeCancelled(terminal: TerminalCancelState): void {
        this._state = terminal
        this.untrackLifecycle()
        if (this._scopedTransactions) {
            for (const transaction of this._scopedTransactions.values()) {
                transaction.markTreeCancelled(terminal)
            }
            this._scopedTransactions.clear()
        }
        resetMutationDraft(this._draft)
    }

    private untrackLifecycle(): void {
        if (!this._lifecycleTracked) return
        this._lifecycleTracked = false
        untrackStoreCancellable(this._data, this)
    }

    private untrackTree(): void {
        this.untrackLifecycle()
        if (!this._scopedTransactions) return
        for (const transaction of this._scopedTransactions.values()) {
            transaction.untrackTree()
        }
    }

    /** Disposal-only cancellation: idempotent and valid after terminal mark.
     *  This is the `StoreCancellable` contract — store lifecycle code cancels
     *  through the symbol and never names this class. */
    [CANCEL_ON_STORE_DISPOSE](): void {
        if (this._implicitBatch && this._parentTransaction) {
            const parent = this._parentTransaction
            const scopedTransactions = parent._scopedTransactions
            if (
                scopedTransactions &&
                scopedTransactions.get(this._data.id) === this
            ) {
                scopedTransactions.delete(this._data.id)
                if (scopedTransactions.size === 0) {
                    parent._scopedTransactions = undefined
                }
            }
            this._parentTransaction = undefined
            this.cancelTree(TRANSACTION_DISPOSED)
            return
        }
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
        this.invalidateSelectorCache()
        if (isFamilyAtom(atom)) {
            this.noteFamilyWrite(atom.family)
            this.stageFamilyMembership(atom)
        }
        return resolved as V
    }

    /** Stage a family member's membership into this level's working index —
     *  the family-index half of a `set`, shared with the commit-time
     *  registration of members a body read lazily initialized. Must run while
     *  the context is OPEN: `cloneFamilyIntoTxn` may read through `this.get` to
     *  first materialize the family index. */
    private stageFamilyMembership(atom: AtomFamilyAtom<any, any>): void {
        const draft = this._draft
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
        this.noteFamilyWrite(family)
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
                this.invalidateSelectorCache()
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
        this.noteFamilyWrite(atom.family)
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
                undefined,
                this._implicitBatch,
            )
        }
        return this._parentTransaction[EXECUTE_TRANSACTION](callback, false)
    };

    /** Return this transaction's context for a descendant store. Batched store
     *  reads use the same scoped transaction tree as explicit `txn.scope()` so
     *  inherited pending values are resolved without losing descendant shadows
     *  or evaluating selectors in the wrong store. */
    [TRANSACTION_FOR_STORE](data: StoreData): TransactionContext {
        this.assertOpen("read from")
        if (data === this._data) return this

        const scopePath: StoreData[] = []
        let current: StoreData | undefined = data
        while (current && current !== this._data) {
            scopePath.push(current)
            current = current.parent
        }
        if (!current) {
            throw new Error(
                `Store '${data.id}' is not a descendant of transaction store '${this._data.id}'`,
            )
        }

        let transaction: TransactionContext = this
        for (let index = scopePath.length - 1; index >= 0; index--) {
            transaction = transaction.scopedTransaction(scopePath[index].id)
        }
        return transaction
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
        }
        // A family member a body read lazily initialized wrote its default into
        // committed data.values but was never registered in its family index —
        // the direct-read path's post-read SETTLE_INIT_ONLY has no analogue here
        // because the commit discards the body-read set. Fold that registration
        // into the working index NOW, while every context is still OPEN (staging
        // may read through this.get to first materialize the family index), so
        // the ordinary commit settles membership atomically with the txn's own
        // writes: one notification per family, respecting final intent (a member
        // the txn also deleted/unset stays out; one it also set is already
        // staged), and visible to every subscriber the commit releases. The hot
        // path — a pure-set txn never touches initializedAtoms — is unchanged.
        root.stageLazyFamilyMemberships()
        // With lazy inits in play the commit may be followed by the repair pass
        // below, and each opens its own inner boundary. Span BOTH with one outer
        // boundary so onCommitEnd still fires exactly once, after the repair —
        // otherwise the commit's boundary closes first and a failed commit
        // reports commit-end, then notifies, then reports commit-end again. Only
        // a lazy-init commit pays for this; the hot path never allocates it.
        let commitEndTree: StoreTreeRuntime | undefined
        if (commitEndRegistry.count !== 0 && root.hasLazyInitMembers())
            commitEndTree = beginCommit(root._data)
        let succeeded = false
        if (root._scopedTransactions) {
            root.setScopedTreeState(TRANSACTION_COMMITTING)
        }
        root._state = TRANSACTION_COMMITTING
        try {
            root.commitOpenTransaction(source)
            succeeded = true
        } catch (error) {
            // The commit failed partway — e.g. an unrelated atom's `equal` threw
            // in the write phase, before the staged family index was written.
            // The lazily-read members' VALUES landed during the body regardless,
            // so without this they would again hold a value while being absent
            // from get(family): the original corruption, reached through the
            // exceptional path. Register whatever the commit left unregistered,
            // best-effort, then let the original error propagate untouched.
            try {
                const repairs = root.collectAbortedLazyMembers(undefined, true)
                if (repairs) root.settleAbortedLazyMembers(repairs)
            } catch {}
            throw error
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
            // Closed LAST, after the repair pass, so the tree reports commit-end
            // once — and strictly after the lifecycle transition above, because
            // an onCommitEnd listener may throw: closing first would abandon the
            // rest of this block, stranding the tree in "committing" (a retained
            // handle would report the wrong state and stay lifecycle-tracked).
            // On failure listener errors are swallowed: they must never mask the
            // commit's own error.
            if (commitEndTree) endCommit(commitEndTree, !succeeded)
        }
    }

    /** True when this context or any nested scope lazily initialized a family
     *  member — whether or not staging kept it. This gates the outer commit-end
     *  boundary, so it must cover every member the repair pass could touch, NOT
     *  just the staged ones: staging deliberately skips unset and deleted
     *  members, and gating on the staged list alone would let a repair triggered
     *  by `get(m); unset(m); <throwing write>` run outside the boundary and
     *  report commit-end twice. The single-store hot path (nothing lazily
     *  initialized, no scopes) answers on the first line. */
    private hasLazyInitMembers(): boolean {
        if (this._draft.lazyInitMembers !== undefined) return true
        const initialized = this._draft.initializedAtoms
        if (initialized) {
            for (const atom of initialized) {
                if (isFamilyAtom(atom)) return true
            }
        }
        if (this._scopedTransactions) {
            for (const scopedTxn of this._scopedTransactions.values()) {
                if (scopedTxn.hasLazyInitMembers()) return true
            }
        }
        return false
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
        // arms (including the cross-scope tree plan) keep their outer boundary
        // and flush below: the single-store cleanup shape still shares its
        // write phase with the unmigrated single-store global fan-out adapter,
        // whose branch is only known after that phase.
        if (
            !this._scopedTransactions &&
            !this._draft.hasCommitEffects &&
            !draftHasCleanupMutations(this._draft) &&
            // Lazily-initialized members need the commit's init trigger group,
            // which only the forest plan below carries — this arm's bulk
            // coordinator settles nothing but its own staged writes.
            this._draft.lazyInitMembers === undefined
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
        // boundaries (see settleCommit's wrapper); nested inside this one
        // they just move the depth counter. With no listener anywhere this is a
        // single counter read, so the Bencher-gated txn hot path is unchanged.
        //
        // This boundary is opened before the write phase can tell whether the
        // overlay changes anything, so it closes with `didWork: false` and lets
        // the nested boundary of whatever actually settles decide. An all-equal
        // commit settles nothing, opens no inner boundary, and notifies nobody.
        let commitEndTree: StoreTreeRuntime | undefined
        if (commitEndRegistry.count !== 0)
            commitEndTree = beginCommit(this._data)
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
            if (commitEndTree) endCommit(commitEndTree, !succeeded, !succeeded)
        }
    }

    private commitWork = (sink: ChangeSink | undefined) => {
        // Single-store path: no scoped transactions to coordinate. Translate
        // the finalized overlay into the commit engine — the bulk coordinator,
        // or a single-entry commit-forest CommitPlan for cleanup mutations.
        // (The hook-free arm committed its own plan from commitOpenTransaction.)
        // Global peer fan-out rides the same CommitPlan: globalEffects applies
        // peer values before hooks, then settleCommitForest settles them with
        // the local work.
        if (!this._scopedTransactions) {
            this.renderDirtyAtomFamilyIndexes()
            const draft = this._draft
            // Commit-scoped initialization set — deliberately NOT the draft's
            // body-read set: atoms lazily initialized while the callback ran
            // must not be re-propagated by the write phase.
            const initializedAtomsSet = new Set<Atom>()
            if (
                !draftHasCleanupMutations(draft) &&
                draft.lazyInitMembers === undefined
            ) {
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

            // Cleanup commit: complete ALL mutations first (phases 1–2
            // inline), then hand the plan to the engine for hooks, settlement,
            // cleanup ordering, and error arbitration. The store is ONE forest
            // entry carrying its update/delete/unset trigger groups, so it is
            // visited once against their union — the same canonical settlement
            // the cross-scope and global-peer shapes already use.
            const onSets: DeferredOnSet[] = []
            const updatedAtoms = writeAtoms(
                draft.values,
                this._data,
                initializedAtomsSet,
                "collect",
                onSets,
            )
            const deleted = draft.deletes?.size
                ? workGroup([...draft.deletes])
                : undefined
            if (draft.deletes?.size) {
                deleteAtomFamilyAtoms(draft.deletes, this._data)
            }
            const unsetAtoms = draft.unsets?.size
                ? workGroup(applyUnsets(draft.unsets, this._data))
                : undefined

            const errors = createCommitErrors()
            // Global peers are writes too: apply them all while still in the
            // write phase. An empty map means every peer was value-equal — a
            // local plan handles that exactly like no globals at all.
            const globalSets = collectGlobalOnSets(onSets)
            const initWork = this.partitionInitWork(updatedAtoms)
            const entries = singleStoreForest(
                this._data,
                initWork.updated,
                deleted,
                unsetAtoms,
                initWork.init,
            )
            runCommitPlan({
                data: this._data,
                settlement: forestSettlement(
                    this._data,
                    entries,
                    globalSets &&
                        globalEffects(
                            this._data,
                            globalSets,
                            "set",
                            applyGlobalSets,
                        ),
                    settleCommitForest,
                ),
                onSets,
                errors,
                report: sink,
                // continueAfterError stays default: a hook error must not
                // starve settlement of already-applied writes.
            })
            return
        }

        // Cross-scope path: write the whole tree (root + every nested scope)
        // first, then settle each affected store exactly once through one
        // forest CommitPlan. This guarantees no subscriber, onSet hook, or
        // selector ever observes a half-applied transaction — root written
        // while a scope isn't, or scope A written while scope B isn't.
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
                "collect",
                entry.onSets,
            )
            if (txn._draft.deletes?.size) {
                deleteAtomFamilyAtoms(txn._draft.deletes, entry.data)
                entry.deleted = workGroup([...txn._draft.deletes])
            }
            if (txn._draft.unsets?.size) {
                // Detach shadows in the write phase so every store's values are
                // final before any propagation pass reads through the chain.
                entry.unsetAtoms = workGroup(
                    applyUnsets(txn._draft.unsets, entry.data),
                )
            }
            const initWork = txn.partitionInitWork(entry.updatedAtoms)
            entry.updatedAtoms = initWork.updated
            entry.initAtoms = initWork.init
        }

        const errors = createCommitErrors()

        // Global peers are writes too. Apply them all before entering the hook
        // phase, preserving the root-first hook/fan-out order of the plan.
        let globalSets: DeferredGlobalSet[] | undefined
        for (const entry of plan) {
            const entrySets = collectGlobalOnSets(entry.onSets)
            if (!entrySets) continue
            if (globalSets) globalSets.push(...entrySets)
            else globalSets = entrySets
        }

        // Every value across the tree and every global peer is now applied.
        // Hand the finalized plan to the commit engine as ONE commit-forest
        // CommitPlan: hooks fire root-first in phase 3 (the flatten preserves
        // the historical per-entry order), then settleCommitForest
        // settles each affected store exactly once against the union of its
        // own writes and inherited changes, fires every subscriber once, and
        // brackets any global peer fan-out — see the walk's header. The outer
        // commit-end boundary and the sink flush stay with
        // commitOpenTransaction, exactly like the single-store cleanup plan.
        const onSets: DeferredOnSet[] = []
        for (const entry of plan) {
            for (const deferred of entry.onSets) onSets.push(deferred)
        }
        runCommitPlan({
            data: this._data,
            settlement: forestSettlement(
                this._data,
                plan,
                globalSets &&
                    globalEffects(
                        this._data,
                        globalSets,
                        "set",
                        applyGlobalSets,
                    ),
                settleCommitForest,
            ),
            onSets,
            errors,
            report: sink,
            // continueAfterError stays default: a hook error must not starve
            // settlement of already-applied writes.
        })
    }

    // Depth-first pre-order: this store, then each nested scope. Produces a
    // root-first plan used directly for the settlement walk and reversed for
    // the write pass (so descendants are written before their ancestors).
    // `parent.children` links direct scoped entries for the walk.
    private collectStores = (plan: CommitWrite[], parent?: CommitWrite) => {
        const entry: CommitWrite = {
            txn: this,
            data: this._data,
            updatedAtoms: [],
            deleted: undefined,
            unsetAtoms: undefined,
            initAtoms: undefined,
            children: undefined,
            onSets: [],
        }
        plan.push(entry)
        if (parent) {
            if (parent.children) parent.children.push(entry)
            else parent.children = [entry]
        }
        if (this._scopedTransactions) {
            for (const [, scopedTxn] of this._scopedTransactions) {
                scopedTxn.collectStores(plan, entry)
            }
        }
    }

    private get selectorCache() {
        if (!this._draft.selectorCache) this._draft.selectorCache = new Map()
        return this._draft.selectorCache
    }

    /** Invalidate every selector cache a write at this level can affect.
     *
     *  A scoped context evaluates selectors against its OWN data but resolves
     *  their atom reads through `this.get` — which falls through to the parent
     *  transaction's draft. So a write anywhere in a working tree can change
     *  what a selector cached at another level would return, and a per-level
     *  dirty flag would keep serving the pre-write value. Mark the whole tree
     *  instead; each level clears its own cache lazily on its next selector
     *  read (see `get`).
     *
     *  The single-store hot path — no parent, no scopes — never leaves the
     *  first two lines. */
    private invalidateSelectorCache() {
        if (!this._draft.dirty) this._draft.dirty = true
        if (!this._parentTransaction && !this._scopedTransactions) return
        this.rootTransaction().markTreeSelectorCachesDirty()
    }

    private markTreeSelectorCachesDirty(): void {
        if (!this._draft.dirty) this._draft.dirty = true
        if (!this._scopedTransactions) return
        for (const scopedTxn of this._scopedTransactions.values()) {
            scopedTxn.markTreeSelectorCachesDirty()
        }
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

    /** Fold the membership of every family member a body read lazily
     *  initialized into this context's (and every nested scope's) working index,
     *  so the ordinary commit settles it atomically with the txn's own writes.
     *  A member the txn also DELETED is left alone so `del` wins (final intent),
     *  and the authority on that is the working index's tombstone, walked up the
     *  inherited chain — not `draft.deletes`, which `del` fills only when the
     *  member has a LOCAL committed value. A scope's `del` of an inherited member
     *  writes just a tombstone (the value lives in an ancestor), so reading the
     *  local set there would resurrect it.
     *
     *  Every other member IS staged, `unset` included: unset resets a member to
     *  its default and keeps its membership, and its own settlement re-registers
     *  it only where a local value was actually detached — for an inherited
     *  scoped value there is nothing to detach, so nothing would register it and
     *  the member would vanish. `reset` likewise writes the draft without staging
     *  membership. Staging is idempotent, so a member a `set` already staged
     *  no-ops here.
     *
     *  Members whose membership this stages are remembered on the draft, so the
     *  write phase can hand the ones no write actually notified to the commit's
     *  init group. Runs while the tree is OPEN — stageFamilyMembership may read
     *  through this.get. The single-store hot path (a pure-set txn never
     *  allocates initializedAtoms) short-circuits at once. */
    private stageLazyFamilyMemberships(): void {
        const draft = this._draft
        const initialized = draft.initializedAtoms
        if (initialized && initialized.size) {
            let staged: Atom[] | undefined
            for (const atom of initialized) {
                if (!isFamilyAtom(atom)) continue
                const stagedIndex = this.familyIndexFor(atom, draft.values)
                if (
                    stagedIndex &&
                    isAtomDeletedInFamilyIndex(atom, stagedIndex)
                )
                    continue
                this.stageFamilyMembership(atom)
                if (!staged) staged = []
                staged.push(atom)
            }
            draft.lazyInitMembers = staged
        }
        if (this._scopedTransactions) {
            for (const scopedTxn of this._scopedTransactions.values()) {
                scopedTxn.stageLazyFamilyMemberships()
            }
        }
    }

    /** Record that a real write staged membership for `family`, so the commit
     *  can tell a family index that changed because of an actual write from one
     *  that changed only because a lazy read registered a member. */
    private noteFamilyWrite(family: AtomFamily<any, any>): void {
        const draft = this._draft
        if (!draft.writtenFamilies) draft.writtenFamilies = new Set()
        draft.writtenFamilies.add(family)
    }

    /** Split the write phase's `updatedAtoms` into what the commit should settle
     *  as ordinary updates and what it should settle as init work.
     *
     *  Two kinds move to the init group. First, lazily-initialized members the
     *  write phase did not notify for — classified from `updatedAtoms`, the
     *  write phase's ACTUAL outcome, rather than by re-running `atom.equal` to
     *  predict it (that would invoke user code twice per member and, for a
     *  stateful comparator, could disagree with the write phase and notify twice
     *  or not at all). Second, family objects whose index changed ONLY because
     *  staging registered such a member: a selector over `get(family)` is reached
     *  through the family object, so leaving it among the ordinary updates would
     *  attribute that selector to a real write and report it to `onChange` —
     *  where the direct read this stands in for reports nothing at all. A family
     *  a real write also touched stays put and reports normally. */
    private partitionInitWork(updatedAtoms: Atom[]): {
        updated: Atom[]
        init: NonEmpty<Atom<any>> | undefined
    } {
        const staged = this._draft.lazyInitMembers
        if (!staged) return { updated: updatedAtoms, init: undefined }
        // One pass over updatedAtoms, then O(1) membership tests: a bulk
        // transaction can stage thousands of members, and scanning the array per
        // member would make classification quadratic.
        const updatedSet = new Set<Atom>(updatedAtoms)
        const written = this._draft.writtenFamilies
        let init: Atom[] | undefined
        for (const atom of staged) {
            if (updatedSet.has(atom)) continue
            if (!init) init = []
            init.push(atom)
        }
        let updated = updatedAtoms
        const initOnlyFamily = (atom: Atom) =>
            isAtomFamily(atom) && !written?.has(atom as AtomFamily<any, any>)
        if (updatedAtoms.some(initOnlyFamily)) {
            updated = []
            for (const atom of updatedAtoms) {
                if (initOnlyFamily(atom)) {
                    if (!init) init = []
                    init.push(atom)
                } else {
                    updated.push(atom)
                }
            }
        }
        return { updated, init: init as NonEmpty<Atom<any>> | undefined }
    }

    /** Snapshot the lazily-read family members of every context in this working
     *  tree, before any of it is marked terminal or reset. Each context is paired
     *  with its OWN store — exactly where a direct read on that store would
     *  register (a scoped read resolves its value in an ancestor but still
     *  registers membership in the scope's shadow index). Only freshly
     *  initialized members reach the set — a deleted-member read is deliberately
     *  excluded upstream — so every entry warrants settlement.
     *
     *  `forRepair` is the failed-COMMIT variant. It repairs the invariant a
     *  half-applied commit can break — a live member must be visible in
     *  get(family) — so it skips members already registered (whatever the commit
     *  landed must not be notified twice) and members whose deletion actually
     *  APPLIED, read from the committed index's tombstone. What applied, not what
     *  was intended, is the test: a commit that threw before writing the index
     *  leaves no tombstone and the member must be registered; one that threw
     *  after leaves the tombstone and registering would resurrect a phantom.
     *  Value presence cannot answer this — a scope's `del` removes no ancestor
     *  value — and delete INTENT gets the first case exactly backwards. On an
     *  ABORT nothing was applied at all, so every lazily-read member is
     *  registered exactly as the direct read that landed its value would. */
    private collectAbortedLazyMembers(
        settles?: LazyInitSettle[],
        forRepair = false,
    ): LazyInitSettle[] | undefined {
        const initialized = this._draft.initializedAtoms
        if (initialized && initialized.size) {
            let members: Atom[] | undefined
            for (const atom of initialized) {
                if (!isFamilyAtom(atom)) continue
                if (forRepair) {
                    // Skip what the commit already landed (registering again
                    // would notify twice) and what it actually deleted.
                    const index = this.familyIndexFor(atom, this._data.values)
                    if (
                        index &&
                        (hasOwnFamilyAtom(
                            index,
                            atom as AtomFamilyAtom<any, any>,
                        ) ||
                            isAtomDeletedInFamilyIndex(atom, index))
                    )
                        continue
                }
                if (!members) members = []
                members.push(atom)
            }
            if (members) {
                if (!settles) settles = []
                settles.push({ data: this._data, atoms: members })
            }
        }
        if (this._scopedTransactions) {
            for (const scopedTxn of this._scopedTransactions.values()) {
                settles = scopedTxn.collectAbortedLazyMembers(
                    settles,
                    forRepair,
                )
            }
        }
        return settles
    }

    /** This store's family index for `atom`, read out of `values` — the draft
     *  (what this transaction INTENDED) or committed data (what actually
     *  APPLIED). The tombstone in that index, not a local cleanup set nor the
     *  presence of a value up the parent chain, is the authority on whether a
     *  member is deleted: a scope's `del` of an INHERITED member writes only a
     *  tombstone, and the value goes on living in the ancestor. */
    private familyIndexFor(atom: Atom, values: StoreData["values"]) {
        return values.get((atom as AtomFamilyAtom<any, any>).family)?.__index
    }

    /** Settle an aborted tree's lazily-read members with the same init-only
     *  settlement a direct read performs (storeFromStoreData) — registering
     *  membership AND propagating dependent selectors, which a bare index write
     *  would leave permanently stale.
     *
     *  Two phases, because a settlement pass evaluates selectors: EVERY store's
     *  membership is registered before ANY propagation begins, then the whole
     *  tree settles as one commit forest. Settling store-by-store instead would
     *  let the root's pass cascade into a scope and evaluate that scope's
     *  family selector against an intermediate tree — before the scope's own
     *  member is registered — and then evaluate it a second time on the scope's
     *  own pass. One forest visits each store exactly once, against the union of
     *  its triggers, behind one boundary and one notification phase.
     *
     *  Each store's members go in as init work, together with their family
     *  objects: registration in phase 1 means the walk's own family bookkeeping
     *  finds nothing to change, so the family object is what carries a
     *  `get(family)` selector into the pass. Errors are swallowed — this runs
     *  while the tree unwinds the callback error that caused the abort, which
     *  must never be masked. */
    private settleAbortedLazyMembers(settles: LazyInitSettle[]): void {
        let commitEndTree: StoreTreeRuntime | undefined
        if (commitEndRegistry.count !== 0)
            commitEndTree = beginCommit(this._data)
        try {
            const timestamp = performance.now()
            const entries: CommitForestEntry[] = []
            for (const settle of settles) {
                const byFamily = new Map<
                    AtomFamily<any, any>,
                    Set<AtomFamilyAtom<any, any>>
                >()
                for (const atom of settle.atoms) {
                    const family = (atom as AtomFamilyAtom<any, any>).family
                    let members = byFamily.get(family)
                    if (!members) {
                        members = new Set()
                        byFamily.set(family, members)
                    }
                    members.add(atom as AtomFamilyAtom<any, any>)
                }
                const initAtoms: Atom[] = [...settle.atoms]
                for (const [family, members] of byFamily) {
                    try {
                        addFamilyAtomsToSet(
                            family,
                            members,
                            settle.data,
                            timestamp,
                        )
                    } catch {}
                    initAtoms.push(family as unknown as Atom)
                }
                entries.push({
                    data: settle.data,
                    updatedAtoms: [],
                    deleted: undefined,
                    unsetAtoms: undefined,
                    initAtoms: initAtoms as NonEmpty<Atom<any>>,
                    children: undefined,
                })
            }
            try {
                settleCommitForest(
                    entries,
                    undefined,
                    undefined,
                    undefined,
                    createCommitErrors(),
                )
            } catch {}
        } finally {
            if (commitEndTree) endCommit(commitEndTree, true)
        }
    }

    private scopedTransaction(scopeId: string) {
        if (!this._scopedTransactions) this._scopedTransactions = new Map()
        if (!this._scopedTransactions.has(scopeId)) {
            const scopedData = this._data.scopes.get(scopeId)!
            const scopedTransaction = new TransactionContext(
                scopedData,
                this,
                undefined,
                undefined,
                this._implicitBatch,
            )
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
    txn[CANCEL_ON_STORE_DISPOSE]()

/** Whether an adapter-owned implicit transaction can still accept reads/writes. */
export const isTransactionOpen = (txn: TransactionContext): boolean =>
    txn[TRANSACTION_IS_OPEN]()

/** Internal read bridge used by implicit batched transactions. */
export const transactionForStore = (
    txn: TransactionContext,
    data: StoreData,
): TransactionContext => txn[TRANSACTION_FOR_STORE](data)

export const transaction = (
    callback: TransactionFn,
    data: StoreData,
    name?: string,
) => {
    const txn = new TransactionContext(data, undefined, undefined, name)
    return txn[EXECUTE_TRANSACTION](callback)
}
