import { describe, expect, mock, test } from "bun:test"
import { atom } from "../atom"
import { globalAtom } from "../globalAtom"
import { selector } from "../selector"
import { store } from "../store"
import { withFakeClock } from "../../test/utils/fakeClock"
import { getStoreData } from "./getStoreData"
import { hasCommittedValue } from "./hasCommittedValue"

// Global atom names are process-wide addresses — suffix every fixture.
let uid = 0
const n = (base: string) => `${base}.hcv${uid++}`

describe("hasCommittedValue", () => {
    test("tells an absent entry from a committed undefined", () => {
        const s = store()
        const data = getStoreData(s)
        const nothing = selector(() => undefined, { name: n("nothing") })

        expect(hasCommittedValue(nothing, data)).toBe(false)

        s.get(nothing)
        // The entry exists and its value IS undefined — the one case
        // `values.get()` alone cannot distinguish from the line above.
        expect(data.values.get(nothing)).toBeUndefined()
        expect(hasCommittedValue(nothing, data)).toBe(true)
        expect(hasCommittedValue(nothing, data, data.values.get(nothing))).toBe(
            true,
        )
    })

    test("a value in hand answers without probing the map", () => {
        // The hot selector path passes the value it already read, so the probe
        // is paid only when there is an `undefined` to disambiguate.
        const a = atom(1)
        const probed = mock(() => false)
        const trap = { values: { has: probed } } as any

        expect(hasCommittedValue(a, trap, 1)).toBe(true)
        expect(hasCommittedValue(a, trap, null)).toBe(true)
        expect(probed).toHaveBeenCalledTimes(0)

        expect(hasCommittedValue(a, trap, undefined)).toBe(false)
        expect(hasCommittedValue(a, trap)).toBe(false)
        expect(probed).toHaveBeenCalledTimes(2)
    })

    test("an inherited read-through is not a committed value", () => {
        // The trap the third argument documents: on a scope, `getState` resolves
        // to the parent's value, which says nothing about a local entry. Passing
        // it would claim a shadow that does not exist.
        const a = atom({ id: 1 }, { name: n("inherited") })
        const A = store()
        const B = A.scope("B")
        const parentValue = B.get(a)

        expect(parentValue).toEqual({ id: 1 })
        expect(hasCommittedValue(a, getStoreData(B))).toBe(false)
        expect(hasCommittedValue(a, getStoreData(A))).toBe(true)

        B.set(a, { id: 2 })
        expect(hasCommittedValue(a, getStoreData(B))).toBe(true)
    })
})

// The revalidation writes compare against `values.get()` on each store they
// publish to, and an entry can genuinely be absent there: `unset` drops it while
// the subscription (and the timer it retains) stays alive. These assert the
// consequence for both halves of the `equal` contract — a comparator that
// dereferences its operands, and one that reports everything equal.
describe("maxAge revalidation gates its comparator", () => {
    test("a dereferencing comparator survives a tick over an unset entry", () =>
        withFakeClock(async clock => {
            let next = 0
            const operands: unknown[] = []
            const a = atom(() => ({ id: ++next }), {
                name: n("revalidate-deref"),
                maxAge: 20,
                equal: (x: { id: number }, y: { id: number }) => {
                    operands.push(x, y)
                    return x.id === y.id
                },
            })
            const s = store()
            const notified = mock(() => {})
            const unsubscribe = s.sub(a, notified)
            const data = getStoreData(s)

            s.unset(a)
            expect(hasCommittedValue(a, data)).toBe(false)
            notified.mockClear()

            await clock.advance(20)

            // Nothing to compare against, so the comparator is not consulted at
            // all — and the revalidated value lands and notifies.
            expect(operands).toEqual([])
            expect(hasCommittedValue(a, data)).toBe(true)
            expect(notified).toHaveBeenCalledTimes(1)
            const revalidated = s.get(a)

            // Once a value IS committed, the comparator resumes deciding — with
            // two real operands.
            await clock.advance(20)
            expect(operands.every(operand => operand !== undefined)).toBe(true)
            expect(operands.length).toBeGreaterThan(0)
            expect(s.get(a)).not.toEqual(revalidated)
            unsubscribe()
        }))

    test("a comparator that reports everything equal cannot suppress it", () =>
        withFakeClock(async clock => {
            // Post-filtering `equal` would call this comparator with the absent
            // entry, believe the `true`, and skip the write: the subscriber
            // never hears about the revalidation and the next read re-runs the
            // factory instead of returning the revalidated value.
            let next = 0
            const a = atom(() => ++next, {
                name: n("revalidate-loose"),
                maxAge: 20,
                equal: () => true,
            })
            const s = store()
            const notified = mock(() => {})
            const unsubscribe = s.sub(a, notified)

            s.unset(a)
            notified.mockClear()
            await clock.advance(20)

            expect(notified).toHaveBeenCalledTimes(1)
            expect(hasCommittedValue(a, getStoreData(s))).toBe(true)
            expect(s.get(a)).toBe(next)
            unsubscribe()
        }))

    test("a peer store whose entry was unset is republished, not compared", () =>
        withFakeClock(async clock => {
            // The global fan-out publishes to every registered store, and a peer
            // that dropped its entry has nothing to compare against. Left
            // ungated, a dereferencing comparator throws inside the timer and
            // the peer silently diverges from its siblings.
            let next = 0
            const operands: unknown[] = []
            const g = globalAtom(() => ({ id: ++next }), {
                name: n("@valdres/test/peer"),
                maxAge: 20,
                equal: (x: { id: number }, y: { id: number }) => {
                    operands.push(x, y)
                    return x.id === y.id
                },
            })
            const first = store("first")
            const second = store("second")
            const unsubscribeFirst = first.sub(g, () => {})
            const unsubscribeSecond = second.sub(g, () => {})

            second.unset(g)
            expect(hasCommittedValue(g, getStoreData(second))).toBe(false)

            await clock.advance(20)

            expect(operands.every(operand => operand !== undefined)).toBe(true)
            expect(hasCommittedValue(g, getStoreData(second))).toBe(true)
            expect(second.get(g)).toEqual(first.get(g))
            unsubscribeFirst()
            unsubscribeSecond()
        }))
})

describe("an equal-value scope set pins the value it was given", () => {
    test("a custom comparator's equal-but-different object still shadows", () => {
        // scope.test.ts covers the pin itself with numbers, where "equal" and
        // "identical" are indistinguishable. With a comparator that only looks
        // at `id`, the pinned value is observably the one that was SET — the
        // shadow holds the override, not a copy of the inherited value.
        const a = atom(
            { id: 1, label: "parent" },
            {
                name: n("pin-custom-equal"),
                equal: (x: { id: number }, y: { id: number }) => x.id === y.id,
            },
        )
        const A = store()
        const B = A.scope("B")

        B.set(a, { id: 1, label: "scope" })
        expect(hasCommittedValue(a, getStoreData(B))).toBe(true)
        expect(B.get(a)).toEqual({ id: 1, label: "scope" })

        A.set(a, { id: 2, label: "parent-again" })
        expect(A.get(a)).toEqual({ id: 2, label: "parent-again" })
        expect(B.get(a)).toEqual({ id: 1, label: "scope" })
    })
})
