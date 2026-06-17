import { describe, test, expect } from "bun:test"
import { store } from "../src/store"
import { atom } from "../src/atom"
import { selector } from "../src/selector"

/**
 * The immediate (non-batched) single-atom notify path must snapshot the
 * subscriber list at dispatch start, matching the React/Redux contract:
 *
 *  - A listener SUBSCRIBED from inside another listener's callback must NOT
 *    fire for the in-flight change (it fires on the next dispatch).
 *  - A listener UNSUBSCRIBED by another listener mid-dispatch was present at
 *    dispatch start, so it STILL fires for the in-flight change (snapshot
 *    semantics).
 *
 * Before the fix the fast path iterated the LIVE `data.subscriptions` Set, so a
 * mid-dispatch subscribe leaked into the same dispatch and a mid-dispatch
 * unsubscribe was order-dependently skipped.
 */
describe("subscriber list is snapshotted at dispatch start", () => {
    test("fast path: a listener subscribed mid-dispatch does NOT fire same dispatch", () => {
        const store1 = store()
        const atom1 = atom(0)
        const calls: string[] = []

        let unsubC: (() => void) | undefined
        const a = () => {
            calls.push("A")
            // Subscribe C from inside A's callback. C must not fire for the
            // in-flight change.
            if (!unsubC) {
                unsubC = store1.sub(atom1, () => calls.push("C"))
            }
        }
        store1.sub(atom1, a)
        store1.sub(atom1, () => calls.push("B"))

        store1.set(atom1, 1)
        expect(calls).toEqual(["A", "B"])

        // C is now live — it fires on the next dispatch.
        calls.length = 0
        store1.set(atom1, 2)
        expect(calls.sort()).toEqual(["A", "B", "C"])
    })

    test("fast path: a listener unsubscribed mid-dispatch STILL fires (was present at start)", () => {
        const store1 = store()
        const atom1 = atom(0)
        const calls: string[] = []

        let unsubB: (() => void) | undefined
        store1.sub(atom1, () => {
            calls.push("A")
            // Unsubscribe B mid-dispatch. B was present at dispatch start, so
            // under snapshot semantics it still fires for this change.
            unsubB?.()
        })
        unsubB = store1.sub(atom1, () => calls.push("B"))

        store1.set(atom1, 1)
        expect(calls).toEqual(["A", "B"])

        // B is gone on the next dispatch.
        calls.length = 0
        store1.set(atom1, 2)
        expect(calls).toEqual(["A"])
    })

    test("selector-subscriber path: a listener subscribed mid-dispatch does NOT fire same dispatch", () => {
        const store1 = store()
        const atom1 = atom(0)
        const sel1 = selector(get => get(atom1) * 2)
        const calls: string[] = []

        let unsubC: (() => void) | undefined
        store1.sub(sel1, () => {
            calls.push("A")
            if (!unsubC) {
                unsubC = store1.sub(sel1, () => calls.push("C"))
            }
        })
        store1.sub(sel1, () => calls.push("B"))

        store1.set(atom1, 1)
        expect(calls).toEqual(["A", "B"])

        calls.length = 0
        store1.set(atom1, 2)
        expect(calls.sort()).toEqual(["A", "B", "C"])
    })
})
