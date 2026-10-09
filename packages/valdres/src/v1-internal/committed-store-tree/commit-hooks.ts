// Committed drafts -> pending FIFO -> delivery after the synchronous JS stack.
// One module FIFO covers all Stores served by this copy of the core module.
// Draft arrays are allocated only on registration, and handed off at apply.
import type { StoreScopeNode } from "./scope-node"
import type { TreeDraft } from "./tree-transaction"

export interface CommitEntry {
    readonly scope: StoreScopeNode
    readonly callback: () => unknown
}

let pending: (CommitEntry | undefined)[] | undefined
let cursor = 0
let scheduled: (() => void) | undefined
let draining = false
// Scheduling choice, not a public numeric guarantee. Share the budget across
// promise continuations and Stores so self-feeding work yields to other tasks.
const ENTRIES_PER_TASK = 1024
let budget = ENTRIES_PER_TASK
let resetGeneration: object | undefined

// A broken custom/global reporter must not discard callbacks or replace the
// original operation's error. Fallback errors include the original failure.
const fallbackReport = (error: unknown): void => {
    setTimeout(() => {
        throw error
    }, 0)
}
const report = (error: unknown): void => {
    const failed = (failure: unknown): void =>
        fallbackReport(
            new AggregateError(
                [error, failure],
                "Commit callback and error reporter failed",
            ),
        )
    try {
        const reporter = globalThis.reportError
        if (typeof reporter !== "function") return fallbackReport(error)
        const result: unknown = reporter.call(globalThis, error)
        if (
            result !== null &&
            (typeof result === "object" || typeof result === "function")
        )
            Promise.prototype.then.call(
                Promise.resolve(result),
                undefined,
                failed,
            )
    } catch (failure) {
        failed(failure)
    }
}

const schedule = (): void => {
    if (draining || pending === undefined) return
    // A host can discard a wake (for example, restoring real timers). Each
    // publication replaces it; older queued wakes are inert, not extra drains.
    const wake = (): void => {
        if (scheduled !== wake) return
        scheduled = undefined
        drain()
    }
    scheduled = wake
    queueMicrotask(wake)
}

const scheduleReset = (): void => {
    // Recovery attempts share a generation: a new publication must not
    // invalidate an older refill opportunity while producers remain active.
    const generation = (resetGeneration ??= {})
    setTimeout(() => {
        if (resetGeneration !== generation || draining) return
        resetGeneration = undefined // only the first attempt can refill
        budget = ENTRIES_PER_TASK
        drain()
    }, 0)
}

const drain = (): void => {
    if (draining || pending === undefined) return
    scheduled = undefined
    // Only a current-generation task refills the shared budget. Replacing or
    // replaying microtask wakes cannot bypass it, including across Stores.
    if (resetGeneration === undefined) scheduleReset()
    draining = true
    try {
        while (pending !== undefined && cursor < pending.length && budget > 0) {
            const entry = pending[cursor]
            pending[cursor++] = undefined // release even while a later entry awaits
            budget--
            if (entry === undefined || entry.scope.status !== "live") continue
            try {
                // Do not expose the internal entry/scope as callback `this`.
                const callback = entry.callback
                const result = callback()
                if (
                    result !== null &&
                    (typeof result === "object" || typeof result === "function")
                )
                    // Promise.resolve can return a native promise unchanged;
                    // do not trust its overridable own `catch` or `then`.
                    Promise.prototype.then.call(
                        Promise.resolve(result),
                        undefined,
                        report,
                    )
            } catch (error) {
                report(error)
            }
        }
    } finally {
        draining = false
        if (pending !== undefined && cursor === pending.length)
            pending = undefined
        else if (pending !== undefined) pending.splice(0, cursor)
        cursor = 0
        // An earlier attempt might have been discarded. Add a recovery attempt
        // without postponing surviving attempts from this generation. The first
        // one to run consumes the generation; duplicates then become inert.
        // No self-scheduled retry loop or clock-based budget refill is used.
        if (pending !== undefined && budget === 0) scheduleReset()
    }
}

export const publishCommit = (draft: TreeDraft): void => {
    const entries = draft.commitEntries
    if (entries === undefined) return
    draft.commitEntries = undefined
    if (pending === undefined) pending = entries
    else for (const entry of entries) pending.push(entry)
    schedule()
}

export const discardDisposedCommits = (): void => {
    if (pending === undefined) return
    for (let i = cursor; i < pending.length; i++) {
        if (pending[i]?.scope.status !== "live") pending[i] = undefined
    }
}
