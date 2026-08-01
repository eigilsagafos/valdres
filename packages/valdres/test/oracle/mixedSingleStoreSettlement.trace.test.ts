/** Trace oracle · mixed single-store settlement (pre-union baseline).
 *
 *  A single-store `txn` that mixes ordinary writes with CLEANUP mutations
 *  (`del` / `unset`) does not settle once. `settleTransactionCommit` runs up to
 *  three sequential passes over the SAME store — update, then delete, then
 *  unset — sharing only one `NotifyTarget` and one `ChangeReport` sink. The
 *  cross-scope commit forest already visits each store once against the union
 *  of its writes; the single-store path does not.
 *
 *  This file is the exact behavioral baseline taken BEFORE that union lands.
 *  Every case here passes against unchanged `main`.
 *
 *  ## Reading the `T4:` markers
 *
 *  A case whose NAME starts with `T4:` contains at least one expectation the
 *  mixed-settlement union is expected to CHANGE, so it will fail on the T4 diff
 *  by design — that failure is a decision to make, not a regression. Inside such
 *  a case the individual assertions are marked too: `T4:` for the ones expected
 *  to move, `Invariant:` for the ones that must survive regardless. A case with
 *  no `T4:` in its name should keep passing untouched.
 *
 *  ## Order convention (inherited from `traceRecorder`)
 *
 *  Exact tags lock a position; nested arrays are order-free bags. This file
 *  locks two parent/child orderings EXACTLY, for opposite reasons, and the two
 *  scoped-unset cases differ only in listener registration order to establish
 *  which is which:
 *
 *    - `onChange` — origin store before its ancestors in BOTH cases, so the
 *      order is a real contract.
 *    - `commitEnd` — root-first in the case that registers root first,
 *      child-first in the case that registers child first. Locking both is what
 *      demonstrates the order is registration-derived; it is therefore NOT a
 *      parent/child guarantee callers may depend on. Asserting it as a bag
 *      would prove nothing, since a bag admits either order.
 */
import { expect } from "bun:test"
import { atom } from "../../src/atom"
import { atomFamily } from "../../src/atomFamily"
import { selector } from "../../src/selector"
import { store } from "../../src/store"
import type { Atom } from "../../src/types/Atom"
import type { GetValue } from "../../src/types/GetValue"
import type { Selector } from "../../src/types/Selector"
import type { Store } from "../../src/types/Store"
import type { StoreChange } from "../../src/types/StoreChange"
import { runTraceTable, type TraceCase } from "./runTable"
import {
    type ChangeCall,
    type Recorder,
    traceChange,
    traceCommitEnd,
    traceSub,
} from "./traceRecorder"

/** A selector that pushes the usual `eval:<name>` tag AND appends every value
 *  it computes to `values`, so a case can compare what an INTERMEDIATE pass
 *  observed against the value the commit finally reported. */
const valueTracedSelector = <V>(
    rec: Recorder,
    name: string,
    values: V[],
    get: (get: GetValue) => V,
): Selector<V> =>
    selector(innerGet => {
        rec.push(`eval:${name}`)
        const value = get(innerGet)
        values.push(value)
        return value
    })

/** Flatten every reported change to a comparable shape. `hasValue` is explicit
 *  because the presence of `value` is itself contractual: a `delete` record
 *  carries none, and an `unset` record carries one only when a value is already
 *  available — reporting must never evaluate a lazy default just to fill it. */
const records = (calls: ChangeCall[]) =>
    calls.flatMap(call =>
        call.changes.map((change: StoreChange) => ({
            type: change.type,
            kind: (change as Extract<StoreChange, { kind: string }>).kind,
            hasValue: "value" in change,
            value: (change as { value?: unknown }).value,
        })),
    )

/** Build a scope shadowing `a` whose PARENT value has been de-materialized, so
 *  the child's `effectiveValueAfterUnset` must read through and re-run the
 *  parent's lazy default. That read-through is the only place a `store.unset`
 *  evaluates user code before settling.
 *
 *  The default throws on its `throwOnInit`-th run. Run #1 is consumed by the
 *  setup's `root.unset`; run #2 is the read-through a child unset triggers. */
const scopeOverDematerializedParent = (
    rec: Recorder,
    scopeId: string,
    throwOnInit?: number,
) => {
    let inits = 0
    const a = atom(() => {
        inits++
        rec.push("init:a")
        if (inits === throwOnInit) throw new Error("report boom")
        return 100 + inits
    })
    const root = store()
    const child = root.scope(scopeId)
    root.set(a, 7)
    child.set(a, 99)
    // Drop the root's own value. With no live root consumer the atom stays
    // de-materialized, so a later child unset must re-run the default to report.
    root.unset(a)
    return { a, root, child }
}

// ────────────────────────────────────────────────────── update + family delete

type MixedCtx = {
    changes: ChangeCall[]
    evals: string[]
    act: () => void
    read: () => unknown
}

const mixedCases: TraceCase<MixedCtx>[] = [
    {
        name: "T4: update + family delete — spanning selector evaluates TWICE, reports once",
        build: rec => {
            const s = store()
            const fam = atomFamily<string, [string]>(undefined)
            const first = fam("first")
            const second = fam("second")
            const value = atom(0)
            s.set(first, "a")
            s.set(second, "b")
            const evals: string[] = []
            const view = valueTracedSelector(
                rec,
                "view",
                evals,
                get => `${get(fam).length}:${get(value)}`,
            )
            traceSub(rec, s, view, "view")
            traceSub(rec, s, value, "value")
            traceSub(rec, s, second, "second")
            expect(s.get(view)).toBe("2:0")
            const { calls } = traceChange(rec, s, undefined, {
                selectors: true,
            })
            traceCommitEnd(rec, s)
            evals.length = 0
            return {
                changes: calls,
                evals,
                act: () =>
                    s.txn(txn => {
                        txn.del(second)
                        txn.set(value, 1)
                    }),
                read: () => s.get(view),
            }
        },
        act: ctx => ctx.act(),
        // T4: the two `eval:view` tags are the update pass and the delete pass
        // settling the SAME store; a union settlement collapses them into one.
        // The single deferred notify (one bag) and the single onChange are
        // already union-shaped and must NOT change.
        trace: [
            "eval:view",
            "eval:view",
            ["sub:view", "sub:value", "sub:second"],
            "onChange",
            "commitEnd",
        ],
        assert: ({ changes, evals, read }) => {
            // Every staged write is applied BEFORE any pass settles, so the
            // "intermediate" value the update pass observed already reflects
            // the delete. The second evaluation is pure waste: same inputs,
            // same output, no extra record. That equality is exactly what makes
            // the T4 union safe — no observer can currently see a half-applied
            // value, so collapsing the passes removes work, not information.
            expect(evals).toEqual(["1:1", "1:1"])
            expect(read()).toBe("1:1")

            // Invariant — cardinality and provenance. ONE onChange for the whole
            // transaction, carrying the update pass's records (the atom, then
            // its recomputed selector) followed by the delete pass's record.
            expect(changes).toHaveLength(1)
            expect(changes[0]!.meta.source).toBe("transaction")
            expect(records(changes)).toEqual([
                { type: "atom", kind: "set", hasValue: true, value: 1 },
                {
                    type: "selector",
                    kind: undefined,
                    hasValue: true,
                    value: "1:1",
                },
                {
                    type: "atom",
                    kind: "delete",
                    hasValue: false,
                    value: undefined,
                },
            ])
        },
    },
    {
        name: "T4: update + family delete — record order follows PASS order, not statement order",
        build: rec => {
            const s = store()
            const fam = atomFamily<string, [string]>(undefined)
            const first = fam("first")
            const second = fam("second")
            const value = atom(0)
            s.set(first, "a")
            s.set(second, "b")
            const evals: string[] = []
            const view = valueTracedSelector(
                rec,
                "view",
                evals,
                get => `${get(fam).length}:${get(value)}`,
            )
            traceSub(rec, s, view, "view")
            expect(s.get(view)).toBe("2:0")
            const { calls } = traceChange(rec, s, undefined, {
                selectors: true,
            })
            evals.length = 0
            return {
                changes: calls,
                evals,
                // Statement order REVERSED vs the case above (set first, delete
                // second), to isolate what actually decides record order.
                act: () =>
                    s.txn(txn => {
                        txn.set(value, 1)
                        txn.del(second)
                    }),
                read: () => s.get(view),
            }
        },
        act: ctx => ctx.act(),
        assert: ({ changes, evals, read }) => {
            // Invariant: whatever the union does to sequencing, a mixed txn is
            // still ONE onChange and the final value is still fully applied.
            expect(read()).toBe("1:1")
            expect(changes).toHaveLength(1)

            // T4: the double evaluation is present here too — reversing the
            // statement order does not avoid it, because the passes are keyed
            // by mutation KIND, not by the order the body staged them. The
            // union collapses this to a single "1:1".
            expect(evals).toEqual(["1:1", "1:1"])

            // T4: the surviving claim is the NEGATIVE one — statement order
            // does not decide record order (this case emits the same sequence
            // as the delete-first case above). The specific sequence, however,
            // is a consequence of update-pass-then-delete-pass: `buildChangeGroup`
            // appends selectors after atoms WITHIN a group, so one unioned pass
            // may well emit "atom:set, atom:delete, selector" instead. Re-derive
            // this expectation from the union's grouping rather than porting it.
            expect(records(changes).map(r => `${r.type}:${r.kind}`)).toEqual([
                "atom:set",
                "selector:undefined",
                "atom:delete",
            ])
        },
    },
]

// ───────────────────────────────────────── scoped unset materializing a parent

type ScopeCtx = {
    rootChanges: ChangeCall[]
    childChanges: ChangeCall[]
    act: () => void
    read: () => unknown
}

const scopedUnsetCases: TraceCase<ScopeCtx>[] = [
    {
        name: "T4: scoped unset materializing the parent — the parent cascade settles the child BEFORE the child's own pass",
        build: rec => {
            const { a, root, child } = scopeOverDematerializedParent(rec, "mat")
            const view = selector(get => {
                rec.push("eval:view")
                return `view:${get(a)}`
            })
            traceSub(rec, child, view, "child:view")
            traceSub(rec, child, a, "child:a")
            expect(child.get(view)).toBe("view:99")
            const rootChange = traceChange(rec, root, "root", {
                selectors: true,
            })
            const childChange = traceChange(rec, child, "child", {
                selectors: true,
            })
            // Registered root-first here on purpose; the sibling case below is
            // identical except it registers child-first, and asserts the
            // REVERSED commitEnd pair. That contrast is what proves the order
            // is registration-derived rather than a parent/child contract.
            traceCommitEnd(rec, root, "root")
            traceCommitEnd(rec, child, "child")
            return {
                rootChanges: rootChange.calls,
                childChanges: childChange.calls,
                act: () => child.unset(a),
                read: () => child.get(a),
            }
        },
        act: ctx => ctx.act(),
        // The exact parent-versus-child order. `effectiveValueAfterUnset` runs
        // BEFORE the child settles: it re-runs the parent's lazy default
        // (`init:a`) and settles the parent init-only — and that parent
        // settlement CASCADES into the child, evaluating `view` and delivering
        // `sub:child:view` immediately, outside the child's own deferred notify.
        // Only then does the child's unset pass run, re-evaluating `view`
        // (T4: the redundant second evaluation, whose value is unchanged so it
        // delivers nothing) and flushing its own deferred subscribers.
        trace: [
            "init:a",
            "eval:view",
            "sub:child:view",
            "eval:view",
            "sub:child:a",
            // Contractual: the originating store's listener precedes its
            // ancestor's, independent of registration order.
            "onChange:child",
            "onChange:root",
            // Root registered FIRST here, and fires first. Locked exactly so
            // the companion case below — identical but registered child-first —
            // observes the reverse and thereby PROVES this order is derived
            // from registration, not from any parent/child commit contract.
            "commitEnd:root",
            "commitEnd:child",
        ],
        assert: ({ rootChanges, childChanges, read }) => {
            expect(read()).toBe(102)
            // One report, fanned to the scope listener and its ancestor alike.
            expect(childChanges).toHaveLength(1)
            expect(rootChanges).toHaveLength(1)
            expect(childChanges[0]!.meta.source).toBe("unset")
            // A SCOPE unset carries the inherited value it reverted to — the
            // value `effectiveValueAfterUnset` had to materialize to report.
            //
            // T4: `view` DID change (view:99 → view:102) and DID recompute, yet
            // no selector record is reported. The recompute was performed by the
            // parent's init-only cascade, which settles with `report: undefined`
            // and so reports nothing; by the time the child's own unset pass
            // re-evaluated, the value already matched and was not "changed".
            // The observable effect is a selector subscriber that fired without
            // a corresponding onChange entry. Unioning the passes must state
            // explicitly whether this record starts being emitted.
            expect(records(childChanges)).toEqual([
                { type: "atom", kind: "unset", hasValue: true, value: 102 },
            ])
            expect(records(rootChanges)).toEqual(records(childChanges))
        },
    },
    {
        name: "T4: scoped unset materializing the parent — commitEnd order follows listener registration; onChange order does not",
        build: rec => {
            const { a, root, child } = scopeOverDematerializedParent(
                rec,
                "mat2",
            )
            const view = selector(get => {
                rec.push("eval:view")
                return `view:${get(a)}`
            })
            traceSub(rec, child, view, "child:view")
            traceSub(rec, child, a, "child:a")
            expect(child.get(view)).toBe("view:99")
            // Reversed registration order vs the case above.
            const childChange = traceChange(rec, child, "child", {
                selectors: true,
            })
            const rootChange = traceChange(rec, root, "root", {
                selectors: true,
            })
            traceCommitEnd(rec, child, "child")
            traceCommitEnd(rec, root, "root")
            return {
                rootChanges: rootChange.calls,
                childChanges: childChange.calls,
                act: () => child.unset(a),
                read: () => child.get(a),
            }
        },
        act: ctx => ctx.act(),
        trace: [
            "init:a",
            // T4: the second `eval:view` is the same redundant re-evaluation
            // the case above pins; it is expected to disappear here too.
            "eval:view",
            "sub:child:view",
            "eval:view",
            "sub:child:a",
            // Still child-then-root even though root registered LAST — so this
            // pair is a genuine contract, not an artifact of registration.
            "onChange:child",
            "onChange:root",
            // Reversed vs the case above, matching the reversed registration.
            // Together the two cases show commitEnd order is registration-
            // derived and therefore NOT a parent/child guarantee to rely on.
            "commitEnd:child",
            "commitEnd:root",
        ],
        assert: ({ read }) => expect(read()).toBe(102),
    },
]

// ──────────────────────────────────────────── throwing effective-value report

type ThrowCtx = {
    changes: ChangeCall[]
    thrown: () => unknown
    act: () => void
    /** Write the parent, then report whether the child's scope-local subscriber
     *  observed it — the direct probe for "was unset delegation restored?". */
    parentWriteIsObserved: () => boolean
    read?: () => unknown
}

/** Wire the shared probe for a scope whose unset report throws: capture the
 *  error the operation surfaced, and expose the delegation check. */
const throwProbe = (rec: Recorder, a: Atom<number>, root: Store) => {
    let thrown: unknown
    return {
        thrown: () => thrown,
        capture: (run: () => void) => {
            try {
                run()
            } catch (error) {
                thrown = error
            }
        },
        parentWriteIsObserved: () => {
            const before = rec.events.length
            root.set(a, 555)
            return rec.events.slice(before).includes("sub:child:a")
        },
    }
}

const throwingReportCases: TraceCase<ThrowCtx>[] = [
    {
        name: "T4: direct scoped unset whose effective-value report throws — settlement, delivery AND re-delegation are all skipped",
        build: rec => {
            const { a, root, child } = scopeOverDematerializedParent(
                rec,
                "throw1",
                2,
            )
            traceSub(rec, child, a, "child:a")
            const { calls } = traceChange(rec, child, "child")
            traceCommitEnd(rec, root, "root")
            traceCommitEnd(rec, child, "child")
            const probe = throwProbe(rec, a, root)
            return {
                changes: calls,
                thrown: probe.thrown,
                act: () => probe.capture(() => child.unset(a)),
                parentWriteIsObserved: probe.parentWriteIsObserved,
            }
        },
        act: ctx => ctx.act(),
        // `store.unset` builds its plan with `continueAfterError: false`, so a
        // throw from `beforeSettle` (the effective-value report) short-circuits
        // everything after it: no selector settles, no subscriber fires, no
        // onChange flushes. Only the already-opened commit boundary still closes.
        // Root's commitEnd is registered first, so it fires first here too —
        // the error path does not reorder the boundary, it only empties it.
        trace: ["init:a", "commitEnd:root", "commitEnd:child"],
        assert: ctx => {
            // The report's own error is the one that surfaces.
            expect((ctx.thrown() as Error).message).toBe("report boom")
            // Settlement did not continue and no subscriber fired (the empty
            // spine above); no onChange was flushed either.
            expect(ctx.changes).toHaveLength(0)
            // T4: re-delegation is the plan's `afterSettle`, so it is skipped
            // too — while `detachOwnValue` already ran BEFORE the plan. The
            // scope is left with no own value and a subscription still re-rooted
            // to it, so subsequent PARENT writes go unobserved.
            expect(ctx.parentWriteIsObserved()).toBe(false)
        },
    },
    {
        name: "T4: txn unset whose report throws — onChange still reports the update pass, but its subscribers NEVER fire",
        build: rec => {
            const { a, root, child } = scopeOverDematerializedParent(
                rec,
                "throw2",
                2,
            )
            const other = atom(0)
            child.set(other, 0)
            traceSub(rec, child, a, "child:a")
            traceSub(rec, child, other, "child:other")
            const { calls } = traceChange(rec, child, "child")
            traceCommitEnd(rec, child, "child")
            const probe = throwProbe(rec, a, root)
            return {
                changes: calls,
                thrown: probe.thrown,
                act: () =>
                    probe.capture(() =>
                        child.txn(txn => {
                            txn.set(other, 42)
                            txn.unset(a)
                        }),
                    ),
                parentWriteIsObserved: probe.parentWriteIsObserved,
                read: () => child.get(other),
            }
        },
        act: ctx => ctx.act(),
        // The unset report loop inside `settleTransactionCommit` is deliberately
        // NOT wrapped in try/catch, so its throw escapes the whole settlement —
        // skipping the unset pass AND the shared `notifyDeferred`, which is what
        // the already-completed UPDATE pass was waiting on. The plan's
        // `flushReport` still runs (a txn does not set `continueAfterError:
        // false`), so onChange reports a write no subscriber was told about.
        trace: ["init:a", "onChange:child", "commitEnd:child"],
        assert: ctx => {
            expect((ctx.thrown() as Error).message).toBe("report boom")
            // The update IS applied and IS reported to onChange...
            expect(ctx.read!()).toBe(42)
            expect(ctx.changes).toHaveLength(1)
            expect(ctx.changes[0]!.meta.source).toBe("transaction")
            expect(records(ctx.changes)).toEqual([
                { type: "atom", kind: "set", hasValue: true, value: 42 },
            ])
            // T4: ...but `sub:child:other` is absent from the spine above.
            // Subscriber delivery for an applied, reported write was starved by
            // an UNRELATED pass throwing — onChange and store.sub disagree about
            // whether the write happened. The union must state which one wins.
            //
            // And as in the direct case, re-delegation never ran either.
            expect(ctx.parentWriteIsObserved()).toBe(false)
        },
    },
    {
        name: "txn unset report throw is masked by an EARLIER onSet hook error — first captured commit error wins",
        build: rec => {
            const { a, root, child } = scopeOverDematerializedParent(
                rec,
                "throw3",
                2,
            )
            const other = atom(0, {
                onSet: () => {
                    throw new Error("hook boom")
                },
            })
            child.set(other, 0)
            const { calls } = traceChange(rec, child, "child")
            const probe = throwProbe(rec, a, root)
            return {
                changes: calls,
                thrown: probe.thrown,
                act: () =>
                    probe.capture(() =>
                        child.txn(txn => {
                            txn.set(other, 42)
                            txn.unset(a)
                        }),
                    ),
                parentWriteIsObserved: probe.parentWriteIsObserved,
            }
        },
        act: ctx => ctx.act(),
        assert: ctx => {
            // Invariant: the engine surfaces the FIRST error recorded into the
            // plan's CommitErrors, so the phase-3 hook error wins over the
            // later report throw.
            expect((ctx.thrown() as Error).message).toBe("hook boom")
        },
    },
    {
        name: "with NO onChange listener the effective-value report never runs, so settlement proceeds",
        build: rec => {
            const { a, root, child } = scopeOverDematerializedParent(
                rec,
                "throw4",
                2,
            )
            traceSub(rec, child, a, "child:a")
            // Deliberately no traceChange: `unsetValue` only builds a change
            // sink when a listener exists, and only a sink installs the
            // `beforeSettle` report.
            const probe = throwProbe(rec, a, root)
            return {
                changes: [],
                thrown: probe.thrown,
                act: () => probe.capture(() => child.unset(a)),
                parentWriteIsObserved: probe.parentWriteIsObserved,
            }
        },
        act: ctx => ctx.act(),
        // Observability changes control flow: with nothing watching, the
        // read-through never happens up front, so the child settles and DELIVERS
        // normally. The parent default is still re-run afterwards — by
        // re-delegation — so the same error surfaces from a different phase.
        trace: ["sub:child:a", "init:a"],
        assert: ctx => {
            expect((ctx.thrown() as Error).message).toBe("report boom")
        },
    },
]

runTraceTable(
    "trace oracle · mixed single-store settlement · update + delete",
    mixedCases,
)
runTraceTable(
    "trace oracle · mixed single-store settlement · scoped unset",
    scopedUnsetCases,
)
runTraceTable(
    "trace oracle · mixed single-store settlement · throwing unset report",
    throwingReportCases,
)
