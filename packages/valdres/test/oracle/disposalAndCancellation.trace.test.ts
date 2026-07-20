/** Trace oracle · disposal & cancellation.
 *
 *  Disposing a store terminally drains its subscriptions, mounts, timers, and
 *  listeners; every later operation throws StoreDisposedError; in-flight async
 *  work is cancelled — its signal aborts and its settlement becomes a silent
 *  no-op (no trace events, no throw). onMount cleanups run on dispose. The
 *  process-wide globalStore cannot be disposed. */
import { describe, expect, test } from "bun:test"
import { atom } from "../../src/atom"
import { globalStore } from "../../src/globalStore"
import { store } from "../../src/store"
import { StoreDisposedError } from "../../src/errors/StoreDisposedError"
import {
    createRecorder,
    tracedSelector,
    traceChange,
    traceCommitEnd,
    traceSub,
} from "./traceRecorder"

describe("trace oracle · disposal & cancellation", () => {
    test("every operation throws StoreDisposedError after dispose", () => {
        const s = store()
        const a = atom(0)
        s.set(a, 1)
        s.dispose()

        expect(() => s.get(a)).toThrow(StoreDisposedError)
        expect(() => s.set(a, 2)).toThrow(StoreDisposedError)
        expect(() => s.sub(a, () => {})).toThrow(StoreDisposedError)
        expect(() => s.reset(a)).toThrow(StoreDisposedError)
        expect(() => s.unset(a)).toThrow(StoreDisposedError)
        expect(() => s.txn(() => {})).toThrow(StoreDisposedError)
        expect(() => s.onChange(() => {})).toThrow(StoreDisposedError)
        expect(() => s.onCommitEnd(() => {})).toThrow(StoreDisposedError)
        expect(() => s.scope("x")).toThrow(StoreDisposedError)
        expect(() => s.snapshot()).toThrow(StoreDisposedError)

        // Disposing again is a no-op (does not throw).
        expect(() => s.dispose()).not.toThrow()
    })

    test("in-flight async work is cancelled: signal aborts, settlement is a silent no-op", async () => {
        const rec = createRecorder()
        const s = store()
        let resolve!: (v: number) => void
        const promise = new Promise<number>(r => (resolve = r))
        const sel = tracedSelector(rec, "sel", (_get, opts) => {
            opts.signal.addEventListener("abort", () => rec.push("abort:sel"))
            return promise
        })
        traceSub(rec, s, sel, "sel") // evaluates once (pending)
        traceChange(rec, s, undefined, { atoms: false, selectors: true })
        traceCommitEnd(rec, s)

        rec.clear()
        s.dispose() // cancels the in-flight evaluation

        // The evaluation's AbortSignal fired.
        expect(rec.events).toContain("abort:sel")

        // Settling the (now-orphaned) promise must not fire subscribers /
        // onChange / commitEnd and must not throw.
        const before = [...rec.events]
        resolve(1)
        await Promise.resolve()
        await Promise.resolve()
        expect(rec.events).toEqual(before)
        expect(rec.events).not.toContain("sub:sel")
        expect(rec.events).not.toContain("onChange")
        expect(rec.events).not.toContain("commitEnd")
    })

    test("onMount cleanup runs when the store is disposed", () => {
        const s = store()
        let mounted = false
        let cleaned = false
        const a = atom(0, {
            onMount: () => {
                mounted = true
                return () => {
                    cleaned = true
                }
            },
        })
        const unsub = s.sub(a, () => {})
        expect(mounted).toBe(true)
        expect(cleaned).toBe(false)

        s.dispose()
        expect(cleaned).toBe(true) // disposal ran the mount cleanup

        // The subscription was drained; calling its unsub is a safe no-op.
        expect(() => unsub()).not.toThrow()
    })

    test("detaching a scope disposes it but leaves the root usable", () => {
        const root = store()
        const a = atom(0)
        const child = root.scope("disposal-scope")
        child.set(a, 5)
        expect(child.get(a)).toBe(5)

        child.detach()

        expect(() => child.get(a)).toThrow(StoreDisposedError)
        // The root store keeps working.
        root.set(a, 9)
        expect(root.get(a)).toBe(9)
        root.dispose()
    })

    test("the process-wide globalStore cannot be disposed", () => {
        expect(() => globalStore.dispose()).toThrow(
            "globalStore is process-wide and cannot be disposed",
        )
    })
})
