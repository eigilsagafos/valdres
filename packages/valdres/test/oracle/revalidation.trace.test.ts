/** Trace oracle · revalidation (maxAge / stale-if-error).
 *
 *  A maxAge tick re-fetches on its interval and commits the fresh value with
 *  source "revalidate". Within a staleIfError window a failed re-fetch keeps the
 *  last good value. Driven by the deterministic fake clock so tick timing never
 *  races CI. Written as explicit `test`s (not the table runner) because the fake
 *  clock's install/restore lifecycle wraps the whole build→act→assert. */
import { describe, expect, test } from "bun:test"
import { store } from "../../src/store"
import { cacheState } from "../../src/lib/cacheState"
import { createArchitectureInstrumentation } from "../../src/lib/architectureInstrumentation"
import { getStoreData } from "../../src/lib/getStoreData"
import { mockAsyncSource, withFakeClock } from "../utils/fakeClock"
import {
    assertTrace,
    createRecorder,
    traceChange,
    traceCommitEnd,
    tracedAtom,
    traceSub,
} from "./traceRecorder"

describe("trace oracle · revalidation", () => {
    test("maxAge tick re-fetches and commits with source 'revalidate'", async () => {
        await withFakeClock(async clock => {
            const rec = createRecorder()
            const s = store()
            const source = mockAsyncSource<number>()
            const a = tracedAtom(
                rec,
                "a",
                source.fn as unknown as () => number,
                {
                    maxAge: 100,
                },
            )
            traceSub(rec, s, a, "a") // direct subscriber installs the maxAge timer
            const { calls } = traceChange(rec, s)
            traceCommitEnd(rec, s)

            await source.resolve(1) // initial fetch settles
            expect(s.get(a)).toBe(1)

            // Only trace the revalidation cycle.
            rec.clear()
            calls.length = 0

            await clock.advance(100) // fires one tick → re-fetch
            await source.resolve(2) // revalidation settles

            expect(s.get(a)).toBe(2)
            // Exact observable trace of a revalidation cycle: the tick opens a
            // commit (marking the cacheMeta revalidating), then the resolved
            // value notifies the subscriber + onChange and commits, then the
            // cacheMeta clears in a final commit. Three commit boundaries, one
            // subscriber delivery, one onChange — locked so a reordering of
            // sub:a/onChange or a changed commit-boundary count fails clearly.
            assertTrace(rec.events, [
                "commitEnd",
                "sub:a",
                "onChange",
                "commitEnd",
                "commitEnd",
            ])
            expect(calls.map(c => c.meta.source)).toEqual(["revalidate"])
            expect((calls[0]!.changes[0] as { value: unknown }).value).toBe(2)
        })
    })

    test("staleIfError keeps the last good value when a re-fetch rejects", async () => {
        await withFakeClock(async clock => {
            const rec = createRecorder()
            const s = store()
            const source = mockAsyncSource<number>()
            const a = tracedAtom(
                rec,
                "a",
                source.fn as unknown as () => number,
                {
                    maxAge: 100,
                    staleIfError: 10_000,
                },
            )
            traceSub(rec, s, a, "a")
            const { calls } = traceChange(rec, s)
            traceCommitEnd(rec, s)

            await source.resolve(1)
            expect(s.get(a)).toBe(1)

            rec.clear()
            calls.length = 0

            await clock.advance(100) // tick → re-fetch
            await source.reject(new Error("revalidate boom")) // fails within staleIfError

            // The last good value is preserved.
            expect(s.get(a)).toBe(1)
            // Exact observable trace: the tick and the failed re-fetch each open
            // a commit boundary (cacheMeta revalidating on/off), but the value
            // never changes, so NO subscriber and NO onChange fire. Locked so a
            // stray notification or a changed boundary count fails clearly.
            assertTrace(rec.events, ["commitEnd", "commitEnd"])
            expect(calls).toHaveLength(0)
            expect(rec.events).not.toContain("sub:a")
        })
    })

    test("equal refresh advances freshness with only meta-on/meta-off boundaries", async () => {
        await withFakeClock(async clock => {
            const rec = createRecorder()
            const s = store()
            const source = mockAsyncSource<{ value: number }>()
            const a = tracedAtom(
                rec,
                "a",
                source.fn as unknown as () => { value: number },
                {
                    maxAge: 100,
                    equal: (left, right) => left.value === right.value,
                },
            )
            traceSub(rec, s, a, "a")
            const { calls } = traceChange(rec, s)
            traceCommitEnd(rec, s)
            const first = { value: 1 }

            await source.resolve(first)
            const data = getStoreData(s)
            const initialWriteAt = cacheState.peek(a, data)?.lastWriteAt
            rec.clear()
            calls.length = 0

            const instrumentation = createArchitectureInstrumentation()
            data.architectureInstrumentation = instrumentation
            try {
                await clock.advance(100)
                await source.resolve({ value: 1 })
            } finally {
                delete data.architectureInstrumentation
            }

            expect(s.get(a)).toBe(first)
            expect(cacheState.peek(a, data)?.lastWriteAt).toBeGreaterThan(
                initialWriteAt!,
            )
            assertTrace(rec.events, ["commitEnd", "commitEnd"])
            expect(calls).toHaveLength(0)
            expect(rec.events).not.toContain("sub:a")
            expect(rec.events).not.toContain("onChange")
            expect(instrumentation.counters.commitPlanRuns).toBe(1)
            expect(instrumentation.counters.cacheMetaAllocations).toBe(2)
            expect(instrumentation.counters.globalStoreListCopies).toBe(0)
        })
    })

    test("unsubscribe after meta-on cancels the in-flight result", async () => {
        await withFakeClock(async clock => {
            const rec = createRecorder()
            const s = store()
            const source = mockAsyncSource<number>()
            const a = tracedAtom(
                rec,
                "a",
                source.fn as unknown as () => number,
                {
                    maxAge: 100,
                },
            )
            const unsub = traceSub(rec, s, a, "a")
            const { calls } = traceChange(rec, s)
            traceCommitEnd(rec, s)

            await source.resolve(1)
            rec.clear()
            calls.length = 0

            await clock.advance(100)
            assertTrace(rec.events, ["commitEnd"])
            unsub()
            rec.clear()
            await source.resolve(2)

            expect(rec.events).toEqual([])
            expect(calls).toHaveLength(0)
            expect(s.get(a)).toBe(1)
        })
    })

    test("a superseded controller rejects its late result before CommitPlan", async () => {
        await withFakeClock(async clock => {
            const rec = createRecorder()
            const s = store()
            const source = mockAsyncSource<number>()
            const a = tracedAtom(
                rec,
                "a",
                source.fn as unknown as () => number,
                { maxAge: 100 },
            )
            const { calls } = traceChange(rec, s)
            traceCommitEnd(rec, s)
            let unsub = traceSub(rec, s, a, "a")

            await source.resolve(1, 0)
            await clock.advance(100) // request N
            expect(source.callCount).toBe(2)

            unsub() // cancel N and its controller generation
            unsub = traceSub(rec, s, a, "a")
            await clock.advance(100) // request N+1
            expect(source.callCount).toBe(3)

            rec.clear()
            calls.length = 0
            await source.resolve(3, 2)
            expect(s.get(a)).toBe(3)
            expect(rec.events.filter(event => event === "sub:a")).toHaveLength(
                1,
            )

            rec.clear()
            calls.length = 0
            const data = getStoreData(s)
            const instrumentation = createArchitectureInstrumentation()
            data.architectureInstrumentation = instrumentation
            try {
                await source.resolve(2, 1) // N settles after N+1
            } finally {
                delete data.architectureInstrumentation
            }

            expect(s.get(a)).toBe(3)
            expect(rec.events).toEqual([])
            expect(calls).toHaveLength(0)
            expect(instrumentation.counters.commitPlanRuns).toBe(0)
            unsub()
        })
    })
})
