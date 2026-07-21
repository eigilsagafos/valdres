/** Trace oracle · async selectors.
 *
 *  An async selector settles in its OWN later commit. Two contracts pinned here:
 *    - the settled selector does NOT re-run its own `get` (no self-`eval`);
 *    - a downstream selector DOES recompute on the settle.
 *  Settlement is reported to a `{ selectors: true }` onChange as source
 *  "async-set", and the settle is a separate commitEnd boundary. */
import { describe, expect, test } from "bun:test"
import { store } from "../../src/store"
import type { Store } from "../../src/types/Store"
import { runTraceTable, type TraceCase } from "./runTable"
import {
    type ChangeCall,
    createRecorder,
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

runTraceTable("trace oracle · async selectors", [
    settleSelfCase,
    downstreamCase,
])

describe("trace oracle · async selector error disposition", () => {
    test("all subscribers run, first error wins, and source rejection is not reused", () => {
        const rec = createRecorder()
        const events = rec.events
        const s = store()
        let fulfill!: (value: number) => unknown
        let rejectSource: ((error: unknown) => unknown) | undefined
        let rejectChained: ((error: unknown) => unknown) | undefined
        const chainedPromise = {
            catch: (onRejected: (error: unknown) => unknown) => {
                rejectChained = onRejected
                return chainedPromise
            },
        }
        const sourcePromise = {
            then: (
                onFulfilled: (value: number) => unknown,
                onRejected?: (error: unknown) => unknown,
            ) => {
                fulfill = onFulfilled
                rejectSource = onRejected
                return chainedPromise
            },
        } as unknown as Promise<number>
        const asyncSel = tracedSelector(rec, "asyncSel", () => sourcePromise)
        const firstError = new Error("subscriber one")
        const secondError = new Error("subscriber two")
        const unsubFirst = s.sub(asyncSel, () => {
            events.push("sub:1")
            throw firstError
        })
        const unsubSecond = s.sub(asyncSel, () => {
            events.push("sub:2")
            throw secondError
        })
        const unsubChange = s.onChange(() => events.push("onChange"), {
            atoms: false,
            selectors: true,
        })
        const unsubCommit = s.onCommitEnd(() => events.push("commitEnd"))
        events.length = 0
        let surfaced: unknown

        try {
            try {
                fulfill(42)
            } catch (error) {
                // Model the rejected child returned by Promise.then without
                // creating a process-level unhandled rejection in the runner.
                if (rejectChained) rejectChained(error)
                else surfaced = error
            }

            expect(events).toEqual(["sub:1", "sub:2", "commitEnd"])
            expect(events).not.toContain("onChange")
            expect(rejectSource).toBeDefined()
            expect(rejectChained).toBeUndefined()
            expect(surfaced).toBe(firstError)
            expect(s.get(asyncSel)).toBe(42)
        } finally {
            unsubFirst()
            unsubSecond()
            unsubChange()
            unsubCommit()
        }
    })

    test("rejection cleanup is silent and the next public read re-evaluates", () => {
        const rec = createRecorder()
        const s = store()
        let rejectSource!: (error: unknown) => unknown
        const sourcePromise = {
            then: (
                _onFulfilled: (value: number) => unknown,
                onRejected?: (error: unknown) => unknown,
            ) => {
                rejectSource = onRejected!
                return sourcePromise
            },
        } as unknown as Promise<number>
        let evaluations = 0
        const asyncSel = tracedSelector(rec, "asyncSel", () => {
            evaluations++
            return evaluations === 1 ? sourcePromise : 7
        })
        const unsubSub = traceSub(rec, s, asyncSel, "asyncSel")
        const unsubChange = traceChange(rec, s, undefined, {
            atoms: false,
            selectors: true,
        }).unsub
        const unsubCommit = traceCommitEnd(rec, s)
        rec.clear()

        try {
            rejectSource(new Error("selector boom"))
            expect(rec.events).toEqual([])

            expect(s.get(asyncSel)).toBe(7)
            expect(rec.events).toEqual(["eval:asyncSel"])
            expect(evaluations).toBe(2)
        } finally {
            unsubSub()
            unsubChange()
            unsubCommit()
        }
    })
})
