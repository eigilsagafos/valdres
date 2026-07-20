/** Trace oracle · async selectors.
 *
 *  An async selector settles in its OWN later commit. Two contracts pinned here:
 *    - the settled selector does NOT re-run its own `get` (no self-`eval`);
 *    - a downstream selector DOES recompute on the settle.
 *  Settlement is reported to a `{ selectors: true }` onChange as source
 *  "async-set", and the settle is a separate commitEnd boundary. */
import { expect } from "bun:test"
import { store } from "../../src/store"
import type { Store } from "../../src/types/Store"
import { runTraceTable, type TraceCase } from "./runTable"
import {
    type ChangeCall,
    nextCommit,
    traceChange,
    traceCommitEnd,
    tracedSelector,
    traceSub,
} from "./traceRecorder"

type Deferred = { promise: Promise<number>; resolve: (v: number) => void }
const defer = (): Deferred => {
    let resolve!: (v: number) => void
    const promise = new Promise<number>(r => (resolve = r))
    return { promise, resolve }
}

type Ctx = {
    store: Store
    changes: ChangeCall[]
    settle: () => Promise<void>
    read: () => unknown
}

const settleSelfCase: TraceCase<Ctx> = {
    name: "async selector settle — separate commit, NO self-eval, source 'async-set'",
    build: rec => {
        const s = store()
        const d = defer()
        const asyncSel = tracedSelector(rec, "asyncSel", () => d.promise)
        traceSub(rec, s, asyncSel, "asyncSel") // evaluates once here (pending)
        const { calls } = traceChange(rec, s, undefined, {
            atoms: false,
            selectors: true,
        })
        traceCommitEnd(rec, s)
        return {
            store: s,
            changes: calls,
            settle: async () => {
                const done = nextCommit(s)
                d.resolve(42)
                await done
            },
            read: () => s.get(asyncSel),
        }
    },
    act: ctx => ctx.settle(),
    // The settled selector's get does NOT re-run: no `eval:asyncSel` here.
    trace: ["sub:asyncSel", "onChange", "commitEnd"],
    assert: ctx => {
        expect(ctx.read()).toBe(42)
        expect(ctx.changes.map(c => c.meta.source)).toEqual(["async-set"])
    },
}

const downstreamCase: TraceCase<Ctx> = {
    name: "downstream selector recomputes on the async settle (downstream eval fires)",
    build: rec => {
        const s = store()
        const d = defer()
        const asyncSel = tracedSelector(rec, "asyncSel", () => d.promise)
        const downstream = tracedSelector(
            rec,
            "downstream",
            get => (get(asyncSel) as unknown as number) + 1,
        )
        traceSub(rec, s, downstream, "downstream")
        const { calls } = traceChange(rec, s, undefined, {
            atoms: false,
            selectors: true,
        })
        traceCommitEnd(rec, s)
        return {
            store: s,
            changes: calls,
            settle: async () => {
                const done = nextCommit(s)
                d.resolve(5)
                await done
            },
            read: () => s.get(downstream),
        }
    },
    act: ctx => ctx.settle(),
    // asyncSel does NOT re-eval; downstream recomputes reading the resolved value.
    trace: ["eval:downstream", "sub:downstream", "onChange", "commitEnd"],
    assert: ctx => {
        expect(ctx.read()).toBe(6)
        // downstream reported as a selector change on the settle.
        expect(ctx.changes.map(c => c.meta.source)).toEqual(["async-set"])
    },
}

runTraceTable("trace oracle · async selectors", [settleSelfCase, downstreamCase])
