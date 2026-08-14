/** Trace oracle · error arbitration.
 *
 *  The commit engine runs EVERY handler, records the FIRST error, and rethrows
 *  it after the phase completes — a throwing hook/subscriber/listener never
 *  aborts the write, propagation, notification, or commitEnd. First-error
 *  arbitration is anchored on the contractual orderings: onSet write order,
 *  commit-end listener registration order, and same-atom subscriber
 *  registration order (all locked below). Only subscriber order ACROSS
 *  independent states is incidental — those cases assert "all ran + a first
 *  error surfaced" rather than which one. */
import { describe, expect, test } from "../performance/test-compat"
import { atom } from "../../src/atom"
import { store } from "../../src/store"
import {
    assertTrace,
    createRecorder,
    traceChange,
    traceCommitEnd,
    tracedAtom,
    tracedSelector,
} from "./traceRecorder"

describe("trace oracle · error arbitration", () => {
    test("onSet error does not block the commit; value applied, subscribers fire, error rethrown after", () => {
        const rec = createRecorder()
        const s = store()
        const a = tracedAtom(rec, "a", 0, {
            onSet: () => {
                throw new Error("onSet boom")
            },
        })
        s.sub(a, () => rec.push("sub:a"))
        const { calls } = traceChange(rec, s)
        traceCommitEnd(rec, s)

        rec.clear()
        calls.length = 0
        expect(() => s.set(a, 1)).toThrow("onSet boom")

        // The whole spine still ran, then the hook error surfaced.
        assertTrace(rec.events, ["onSet:a", "sub:a", "onChange", "commitEnd"])
        expect(s.get(a)).toBe(1) // value applied despite the hook throwing
        expect(calls).toHaveLength(1)
    })

    test("first onSet error wins across a multi-atom txn (write order)", () => {
        const rec = createRecorder()
        const s = store()
        const a = tracedAtom(rec, "a", 0, {
            onSet: () => {
                throw new Error("A boom")
            },
        })
        const b = tracedAtom(rec, "b", 0, {
            onSet: () => {
                throw new Error("B boom")
            },
        })

        rec.clear()
        // `a` is written before `b`, so `a`'s hook error is the first recorded.
        expect(() =>
            s.txn(({ set }) => {
                set(a, 1)
                set(b, 2)
            }),
        ).toThrow("A boom")

        // Both hooks ran (run-everything), and both writes committed.
        expect(rec.events.filter(e => e === "onSet:a")).toHaveLength(1)
        expect(rec.events.filter(e => e === "onSet:b")).toHaveLength(1)
        expect(s.get(a)).toBe(1)
        expect(s.get(b)).toBe(2)
    })

    test("first commit-end listener error wins; the other listener still runs", () => {
        const rec = createRecorder()
        const s = store()
        const a = atom(0)
        s.onCommitEnd(() => {
            rec.push("end1")
            throw new Error("end A")
        })
        s.onCommitEnd(() => {
            rec.push("end2")
            throw new Error("end B")
        })

        rec.clear()
        expect(() => s.set(a, 1)).toThrow("end A") // first-registered listener

        expect(rec.events).toContain("end1")
        expect(rec.events).toContain("end2") // the second listener still ran
        expect(s.get(a)).toBe(1)
    })

    test("a throwing subscriber does not starve propagation, other subscribers, or commitEnd", () => {
        const rec = createRecorder()
        const s = store()
        const a = tracedAtom(rec, "a", 0)
        const dbl = tracedSelector(rec, "dbl", get => (get(a) as number) * 2)
        s.sub(a, () => {
            throw new Error("sub boom")
        })
        s.sub(dbl, () => rec.push("sub:dbl"))
        traceCommitEnd(rec, s)

        rec.clear()
        // The directly-set atom's subscriber fires first (atom subs precede
        // selector subs), so its error is the one that surfaces.
        expect(() => s.set(a, 1)).toThrow("sub boom")

        expect(s.get(a)).toBe(1) // value applied
        expect(s.get(dbl)).toBe(2) // downstream recomputed
        expect(rec.events).toContain("eval:dbl")
        expect(rec.events).toContain("sub:dbl") // the other subscriber still ran
        expect(rec.events[rec.events.length - 1]).toBe("commitEnd") // still fired
    })

    test("two subscribers on the SAME atom fire in registration order; first-registered error wins", () => {
        // Registration order within a single atom's subscriber set is observable
        // and contractual (unlike order ACROSS independent atoms, which is
        // incidental). Reversing subscriber iteration would change side-effect
        // order and which error surfaces — this locks it exactly.
        const rec = createRecorder()
        const s = store()
        const a = atom(0)
        s.sub(a, () => {
            rec.push("sub:1")
            throw new Error("sub 1 boom")
        })
        s.sub(a, () => {
            rec.push("sub:2")
            throw new Error("sub 2 boom")
        })

        rec.clear()
        expect(() => s.set(a, 1)).toThrow("sub 1 boom") // first-registered wins

        // Both ran, in registration order.
        expect(rec.events).toEqual(["sub:1", "sub:2"])
        expect(s.get(a)).toBe(1)
    })
})
