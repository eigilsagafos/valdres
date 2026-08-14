/** Self-test for the trace-oracle recorder. Proves the harness itself is sound:
 *  it preserves insertion order, order-free "bags" tolerate reordering, and a
 *  genuine spine reorder still produces an unequal (clearly diffable) result.
 *  Also a smoke test that the public-API wiring records the canonical spine. */
import { describe, expect, test } from "../performance/test-compat"
import { atom } from "../../src/atom"
import { store } from "../../src/store"
import {
    assertTrace,
    canonicalizeTrace,
    createRecorder,
    traceChange,
    traceCommitEnd,
    tracedAtom,
    tracedSelector,
    traceSub,
} from "./traceRecorder"

describe("trace oracle · recorder", () => {
    test("records in insertion order; clear() truncates in place", () => {
        const rec = createRecorder()
        const ref = rec.events
        rec.push("a")
        rec.push("b")
        expect(rec.events).toEqual(["a", "b"])
        rec.clear()
        expect(rec.events).toEqual([])
        // Same array reference survives clear() — a captured handle stays valid.
        expect(rec.events).toBe(ref)
        rec.push("c")
        expect(ref).toEqual(["c"])
    })

    test("assertTrace: exact tags lock position", () => {
        assertTrace(["onSet:a", "sub:a", "onChange", "commitEnd"], [
            "onSet:a",
            "sub:a",
            "onChange",
            "commitEnd",
        ])
    })

    test("assertTrace: a bag tolerates any internal order", () => {
        // Same events, incidental sub-order swapped — a bag must still pass.
        assertTrace(["onSet:a", "sub:y", "sub:x", "onChange"], [
            "onSet:a",
            ["sub:x", "sub:y"],
            "onChange",
        ])
    })

    test("canonicalizeTrace: a genuine spine reorder is NOT equal", () => {
        // onChange/commitEnd swapped — the phase spine is contractual, so the
        // canonical forms must differ (this is the regression-sensitivity proof).
        const { actual, expected } = canonicalizeTrace(
            ["sub:a", "commitEnd", "onChange"],
            ["sub:a", "onChange", "commitEnd"],
        )
        expect(actual).not.toEqual(expected)
    })

    test("canonicalizeTrace: a missing event surfaces in the diff", () => {
        const { actual, expected } = canonicalizeTrace(
            ["sub:a", "commitEnd"],
            ["sub:a", "onChange", "commitEnd"],
        )
        expect(actual).not.toEqual(expected)
    })

    test("smoke: public-API wiring records the canonical spine for a plain set", () => {
        const rec = createRecorder()
        const s = store()
        const a = tracedAtom(rec, "a", 0)
        const double = tracedSelector(rec, "double", get => get(a) * 2)
        traceSub(rec, s, a, "a")
        traceSub(rec, s, double, "double")
        const { unsub: unsubChange } = traceChange(rec, s, undefined, {
            selectors: true,
        })
        const unsubEnd = traceCommitEnd(rec, s)

        rec.clear() // drop setup evals / cold reads
        s.set(a, 1)

        assertTrace(rec.events, [
            "onSet:a",
            "eval:double",
            ["sub:a", "sub:double"],
            "onChange",
            "commitEnd",
        ])
        expect(s.get(a)).toBe(1)
        expect(s.get(double)).toBe(2)

        unsubChange()
        unsubEnd()
    })

    test("smoke: tracedSelector counts every live recompute", () => {
        const rec = createRecorder()
        const s = store()
        const a = atom(0)
        const sel = tracedSelector(rec, "sel", get => get(a) * 2)
        s.sub(sel, () => {})

        rec.clear()
        s.set(a, 1)
        s.set(a, 2)
        expect(rec.events.filter(e => e === "eval:sel")).toHaveLength(2)
    })
})
