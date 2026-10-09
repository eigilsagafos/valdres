/**
 * Recoil's write batching, on Valdres transactions.
 *
 * Recoil runs a `useRecoilCallback` callback inside a batch: every write made
 * during its synchronous part (through the callback interface or through hook
 * setters) is queued, and when the callback returns or throws the queue is
 * applied store by store, each store's writes as one update; a write that
 * fails discards that store's update and stops. A nested callback applies its
 * own batch when it returns, and `transact_UNSTABLE` applies immediately, so
 * both survive a later failure of the outer batch.
 *
 * Here the synchronous part of the outermost callback for a Store runs inside
 * one `store.txn`. Its snapshot reads that transaction, which is exactly the
 * state at call time until something is staged. Writes Recoil applies
 * immediately (nested batches, `transact_UNSTABLE`) are staged into it and
 * bump `epoch`, which retires snapshots taken before them. Once that
 * transaction has committed, the callback's own queue is applied like
 * Recoil's batch end. Writes for other roots wait until then too: their
 * Stores cannot be touched while a transaction is open.
 */
import type { Store, Transaction } from "valdres"
import { applyAction, type Action } from "./actions"
import { unsupported } from "./unsupported"

export interface OpenTransaction {
    /** Undefined for a callback of another root nested in a transaction. */
    readonly tx: Transaction | undefined
    /** Bumped whenever writes are staged before the transaction ends. */
    epoch: number
    /** Set once the synchronous part of the callback has returned. */
    closed: boolean
}

interface OpenFrame extends OpenTransaction {
    readonly tx: Transaction
    /** A nested batch failed after staging some of its writes. */
    poisoned: boolean
}

type Batch = Map<Store, Action[]>

const NONE = Symbol("none")

const batches: Batch[] = []
const openTransactions = new Map<Store, OpenFrame>()
/** Writes Recoil would already have applied to other roots, in order. */
let deferred: [Store, Action[]][] = []

const commit = (store: Store, actions: readonly Action[]) =>
    store.txn(tx => {
        for (const action of actions) applyAction(tx, action)
    })

/** Applies a batch the way Recoil does when it ends. */
const perform = (store: Store, actions: readonly Action[]) => {
    const open = openTransactions.get(store)
    if (open !== undefined) {
        let staged = false
        try {
            for (const action of actions)
                applyAction(open.tx, action, () => {
                    staged = true
                    open.epoch++
                })
        } catch (error) {
            // Recoil discards just this batch; a transaction cannot unstage
            // part of itself, so the enclosing callback must not commit.
            if (staged) open.poisoned = true
            throw error
        }
    } else if (openTransactions.size > 0) {
        deferred.push([store, [...actions]])
    } else {
        commit(store, actions)
    }
}

/** Queues into the innermost batch, or applies the write now. */
export const queueOrPerform = (store: Store, action: Action) => {
    const batch = batches[batches.length - 1]
    if (batch === undefined) {
        perform(store, [action])
        return
    }
    const actions = batch.get(store)
    if (actions === undefined) batch.set(store, [action])
    else actions.push(action)
}

/** Applies `action` now, as Recoil's `transact_UNSTABLE` does. */
export const performNow = (store: Store, action: Action) =>
    perform(store, [action])

/** Runs `callback` in a nested batch that applies when it returns or throws. */
const withNestedBatch = <Result>(callback: () => Result): Result => {
    const batch: Batch = new Map()
    batches.push(batch)
    try {
        return callback()
    } finally {
        batches.pop()
        for (const [store, actions] of batch) perform(store, actions)
    }
}

/**
 * Runs `invoke` as a Recoil callback on `store`. Writes queued before a throw
 * still apply, then the error is rethrown, as in Recoil.
 */
export const runBatched = <Result>(
    store: Store,
    invoke: (open: OpenTransaction) => Result,
): Result => {
    const nested = openTransactions.get(store)
    if (nested !== undefined) return withNestedBatch(() => invoke(nested))
    if (openTransactions.size > 0) {
        // Inside another root's callback this Store cannot be read or written
        // until that transaction ends: its snapshot is unreadable and its
        // writes wait with the other deferred writes.
        const unreadable: OpenTransaction = { tx: undefined, epoch: 0, closed: false }
        try {
            return withNestedBatch(() => invoke(unreadable))
        } finally {
            unreadable.closed = true
        }
    }

    const batch: Batch = new Map()
    let thrown: unknown = NONE
    let result!: Result
    try {
        store.txn(tx => {
            const open: OpenFrame = { tx, epoch: 0, closed: false, poisoned: false }
            openTransactions.set(store, open)
            batches.push(batch)
            try {
                result = invoke(open)
            } catch (error) {
                thrown = error
            } finally {
                batches.pop()
                open.closed = true
                openTransactions.delete(store)
            }
            if (open.poisoned)
                unsupported(
                    "partially failed nested callback batches",
                    "A nested useRecoilCallback batch failed after other writes were staged; Recoil would discard only that batch, which a Valdres transaction cannot do, so none of the outer callback's writes were applied.",
                )
        })
    } catch (error) {
        deferred = []
        throw error
    }

    const pending = deferred
    deferred = []
    for (const [other, actions] of pending) commit(other, actions)
    for (const [target, actions] of batch) commit(target, actions)
    if (thrown !== NONE) throw thrown
    return result
}
