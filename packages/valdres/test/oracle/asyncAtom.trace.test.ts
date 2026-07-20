/** Trace oracle · async atoms.
 *
 *  Setting an atom to a promise pins the pending promise immediately (a "set"
 *  commit) and then settles in a SECOND, later commit with source "async-set".
 *  A superseded in-flight promise (last-write-wins) must never commit. An async
 *  default resolves the same way. Settlement is awaited via an explicit signal
 *  (nextCommit / mockAsyncSource) — never a fixed microtask count. */
import { expect } from "bun:test"
import { store } from "../../src/store"
import type { Atom } from "../../src/types/Atom"
import type { Store } from "../../src/types/Store"
import { mockAsyncSource } from "../utils/fakeClock"
import { runTraceTable, type TraceCase } from "./runTable"
import {
    type ChangeCall,
    nextCommit,
    type Recorder,
    traceChange,
    traceCommitEnd,
    tracedAtom,
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
    states: Record<string, Atom<any>>
    changes: ChangeCall[]
    run: (rec: Recorder) => Promise<void>
    finalValue: () => unknown
}

const asyncSetCase: TraceCase<Ctx> = {
    name: "async set — pending 'set' commit, then 'async-set' settle commit",
    build: rec => {
        const s = store()
        const a = tracedAtom(rec, "a", 0)
        traceSub(rec, s, a, "a")
        const { calls } = traceChange(rec, s)
        traceCommitEnd(rec, s)
        const d = defer()
        return {
            store: s,
            states: { a },
            changes: calls,
            run: async () => {
                s.set(a, d.promise) // commit 1: pending
                const settled = nextCommit(s)
                d.resolve(42)
                await settled // commit 2: async-set
            },
            finalValue: () => s.get(a),
        }
    },
    act: (ctx, rec) => ctx.run(rec),
    // Locked to observed behavior: pending set notifies (value = the promise),
    // then the resolved value settles in its own commit.
    trace: [
        "sub:a",
        "onChange",
        "commitEnd",
        "onSet:a",
        "sub:a",
        "onChange",
        "commitEnd",
    ],
    assert: ctx => {
        expect(ctx.finalValue()).toBe(42)
        expect(ctx.changes.map(c => c.meta.source)).toEqual(["set", "async-set"])
    },
}

const asyncDefaultCase: TraceCase<Ctx> = {
    name: "async default — resolves in one 'async-set' commit",
    build: rec => {
        const s = store()
        const source = mockAsyncSource<number>()
        const a = tracedAtom(rec, "a", source.fn as unknown as () => number)
        traceSub(rec, s, a, "a") // triggers the pending init (cleared after build)
        const { calls } = traceChange(rec, s)
        traceCommitEnd(rec, s)
        return {
            store: s,
            states: { a },
            changes: calls,
            run: async () => {
                await source.resolve(7) // drains microtasks; store settles
            },
            finalValue: () => s.get(a),
        }
    },
    act: (ctx, rec) => ctx.run(rec),
    trace: ["sub:a", "onChange", "commitEnd"],
    assert: ctx => {
        expect(ctx.finalValue()).toBe(7)
        expect(ctx.changes.map(c => c.meta.source)).toEqual(["async-set"])
    },
}

const lastWriteWinsCase: TraceCase<Ctx> = {
    name: "last-write-wins — a superseded in-flight promise never commits",
    build: rec => {
        const s = store()
        const a = tracedAtom(rec, "a", 0)
        traceSub(rec, s, a, "a")
        const { calls } = traceChange(rec, s)
        traceCommitEnd(rec, s)
        const first = defer()
        const second = defer()
        return {
            store: s,
            states: { a },
            changes: calls,
            run: async () => {
                s.set(a, first.promise) // pending #1
                s.set(a, second.promise) // pending #2 supersedes #1
                const settled = nextCommit(s)
                second.resolve(2)
                await settled // #2 wins
                // #1 resolves late — it is superseded and must NOT commit.
                first.resolve(1)
                await Promise.resolve()
                await Promise.resolve()
            },
            finalValue: () => s.get(a),
        }
    },
    act: (ctx, rec) => ctx.run(rec),
    // No `trace` lock (two pending sets + one settle); assert the invariant that
    // the stale resolution produced no extra async-set.
    assert: ctx => {
        expect(ctx.finalValue()).toBe(2)
        const sources = ctx.changes.map(c => c.meta.source)
        // exactly one settlement, and it is the winner (value 2); no second
        // async-set from the superseded promise.
        expect(sources.filter(s => s === "async-set")).toEqual(["async-set"])
        const settle = ctx.changes.find(c => c.meta.source === "async-set")
        expect((settle!.changes[0] as { value: unknown }).value).toBe(2)
    },
}

runTraceTable("trace oracle · async atoms", [
    asyncSetCase,
    asyncDefaultCase,
    lastWriteWinsCase,
])
