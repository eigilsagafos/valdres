import { describe, test, expect, mock } from "bun:test"
import { store } from "../store"
import { atom } from "../atom"
import { selector } from "../selector"

// A child scope can run a transaction that ALSO writes to its parent via
// t.parentScope(...). This is the inverse of the root.txn(t => t.scope(...))
// path: here the *child* starts the txn and reaches UP into the parent. The
// commit still walks to the topmost transaction (txnCommit climbs
// parentTransaction) and runs the same cross-scope, deferred-notification
// commit — one write pass per store (leaf-first) then one propagation pass per
// store (root-first), with subscribers fired ONCE at commit end.
//
// These pin the parentScope commit path under deferred notification:
//   1. A selector spanning the parent atom (written via parentScope) and the
//      child atom (written/shadowed in the child) ends FRESH in both stores.
//   2. Its subscriber fires exactly ONCE with the final value (no stale
//      intermediate), in whichever store(s) it is subscribed.
//   3. onSet on the parent atom (written via parentScope) fires — seeing the
//      fully-applied child write — and fires before subscribers.

describe("parentScope commit under deferred notification", () => {
    describe("spanning selector freshness", () => {
        test("selector spanning parent + child ends fresh in both stores", () => {
            const root = store()
            const child = root.scope("C")
            const r = atom(1, { name: "ps-r" }) // written at parent
            const c = atom(10, { name: "ps-c" }) // shadowed/written in child
            child.set(c, 10) // establish the child shadow before the txn

            const sum = selector(get => get(r) + get(c), { name: "ps-sum" })
            // live in BOTH stores
            root.sub(sum, () => {})
            child.sub(sum, () => {})
            expect(root.get(sum)).toBe(11) // r=1 + root c=10
            expect(child.get(sum)).toBe(11) // r=1 + child c=10

            child.txn(t => {
                t.set(c, 20)
                t.parentScope(pt => pt.set(r, 9))
            })

            // child reads r through the parent (9) + its own c (20)
            expect(child.get(sum)).toBe(29)
            // root reads its own r (9) + its own c (still 10)
            expect(root.get(sum)).toBe(19)
        })

        test("child NEWLY shadows the child atom in the same txn", () => {
            // No pre-existing child shadow of c; the txn creates it. The child
            // selector must recompute against the new shadow AND the parent's
            // new r — never a half-applied intermediate.
            const root = store()
            const child = root.scope("C")
            const r = atom(1, { name: "psn-r" })
            const c = atom(10, { name: "psn-c" }) // child inherits c initially
            const sum = selector(get => get(r) + get(c), { name: "psn-sum" })
            const cb = mock(() => {})
            child.sub(sum, cb)
            expect(child.get(sum)).toBe(11)

            child.txn(t => {
                t.set(c, 20) // first shadow of c in the child
                t.parentScope(pt => pt.set(r, 9))
            })

            expect(child.get(sum)).toBe(29) // 9 + 20
            expect(root.get(sum)).toBe(19) // 9 + 10 (root keeps its c)
            expect(cb).toHaveBeenCalledTimes(1)
        })

        test("transitive chain spanning parent + child stays fresh", () => {
            // A (parent atom only) feeds B (A + child atom). Both selectors span
            // the two stores; each must end on its final value in the child.
            const root = store()
            const child = root.scope("C")
            const r = atom(1, { name: "pst-r" })
            const c = atom(10, { name: "pst-c" })
            child.set(c, 10)
            const A = selector(get => get(r) * 2, { name: "pst-A" })
            const B = selector(get => get(A) + get(c), { name: "pst-B" })
            const cb = mock(() => {})
            child.sub(B, cb)
            expect(child.get(B)).toBe(12) // (1*2) + 10

            child.txn(t => {
                t.set(c, 20)
                t.parentScope(pt => pt.set(r, 5))
            })

            expect(child.get(A)).toBe(10) // 5 * 2
            expect(child.get(B)).toBe(30) // 10 + 20, never the stale 2 + 20 = 22
            expect(cb).toHaveBeenCalledTimes(1)
        })

        test("child newly shadows with the same value the parent is set to", () => {
            // parentScope variant of the newly-shadow hazard: the child shadows X
            // with the same numeric value the parent simultaneously sets X to.
            // The child selector still must recompute (it was reading the
            // inherited 0) and fire exactly once.
            const root = store()
            const child = root.scope("C")
            const X = atom(0, { name: "psm-x" })
            const sel = selector(get => get(X), { name: "psm-sel" })
            const cb = mock(() => {})
            child.sub(sel, cb)
            expect(child.get(sel)).toBe(0)

            child.txn(t => {
                t.set(X, 5) // child shadows X=5
                t.parentScope(pt => pt.set(X, 5)) // parent X=5
            })

            expect(child.get(sel)).toBe(5)
            expect(root.get(X)).toBe(5)
            expect(cb).toHaveBeenCalledTimes(1)
        })
    })

    describe("single, final-valued notification", () => {
        test("child subscriber on the spanning selector fires once with the final value", () => {
            const root = store()
            const child = root.scope("C")
            const r = atom(1, { name: "pso-r" })
            const c = atom(10, { name: "pso-c" })
            child.set(c, 10)
            const sum = selector(get => get(r) + get(c), { name: "pso-sum" })
            const observed: number[] = []
            const cb = mock(() => observed.push(child.get(sum)))
            child.sub(sum, cb)
            expect(child.get(sum)).toBe(11)

            child.txn(t => {
                t.set(c, 20)
                t.parentScope(pt => pt.set(r, 9))
            })

            // Deferred notification: the intermediate half-applied value
            // (1 + 20 = 21, or 9 + 10 = 19) must never be observed.
            expect(observed).not.toContain(21)
            expect(observed).toEqual([29])
            expect(cb).toHaveBeenCalledTimes(1)
        })

        test("the same spanning selector subscribed in BOTH stores fires once per store, each final", () => {
            const root = store()
            const child = root.scope("C")
            const r = atom(1, { name: "psb-r" })
            const c = atom(10, { name: "psb-c" })
            child.set(c, 10)
            const sum = selector(get => get(r) + get(c), { name: "psb-sum" })

            const rootObserved: number[] = []
            const childObserved: number[] = []
            const rootCb = mock(() => rootObserved.push(root.get(sum)))
            const childCb = mock(() => childObserved.push(child.get(sum)))
            root.sub(sum, rootCb)
            child.sub(sum, childCb)
            expect(root.get(sum)).toBe(11)
            expect(child.get(sum)).toBe(11)

            child.txn(t => {
                t.set(c, 20)
                t.parentScope(pt => pt.set(r, 9))
            })

            // Each store's subscriber fires once, with that store's final value.
            expect(rootObserved).toEqual([19]) // 9 + root c (10)
            expect(childObserved).toEqual([29]) // 9 + child c (20)
            expect(rootCb).toHaveBeenCalledTimes(1)
            expect(childCb).toHaveBeenCalledTimes(1)
        })

        test("a subscriber reading from within its callback sees the fully-applied parent write", () => {
            // The child subscriber reads the parent atom directly inside its
            // callback. It must observe the final parent value (9), not the
            // pre-txn value — proving the parent write landed before notify.
            const root = store()
            const child = root.scope("C")
            const r = atom(1, { name: "psr-r" })
            const c = atom(10, { name: "psr-c" })
            child.set(c, 10)
            const seen: Array<[number, number]> = []
            child.sub(c, () => seen.push([child.get(r), child.get(c)]))

            child.txn(t => {
                t.set(c, 20)
                t.parentScope(pt => pt.set(r, 9))
            })

            // The child reads r through the parent — it must be the final 9.
            expect(seen).toEqual([[9, 20]])
        })
    })

    describe("onSet timing on a parentScope write", () => {
        test("onSet on the parent atom fires (seeing the child write) and before subscribers", () => {
            const root = store()
            const child = root.scope("C")
            const c = atom(0, { name: "pot-c" })
            child.set(c, 0)

            const order: Array<[string, number]> = []
            const r = atom(0, {
                name: "pot-r",
                onSet: () => order.push(["onSet:r", child.get(c)]),
            })
            root.sub(r, () => order.push(["sub:r", child.get(c)]))

            child.txn(t => {
                t.set(c, 7)
                t.parentScope(pt => pt.set(r, 1))
            })

            // onSet on the parent atom observes the fully-applied child value
            // (7) and fires before the subscriber — preserving the legacy
            // onSet-before-subscribers ordering.
            expect(order).toEqual([
                ["onSet:r", 7],
                ["sub:r", 7],
            ])
        })

        test("onSet fires for both the parent atom and the child atom in one txn", () => {
            // Both atoms carry onSet. Pin the observed firing order: onSets fire
            // root-first (parent before child), then subscribers root-first.
            // (Writes run leaf-first, but onSet is deferred to the notify phase
            // and replayed in the root-first commit plan order.)
            const root = store()
            const child = root.scope("C")
            const order: string[] = []
            const r = atom(0, {
                name: "po2-r",
                onSet: v => order.push(`onSet:r=${v}`),
            })
            const c = atom(0, {
                name: "po2-c",
                onSet: v => order.push(`onSet:c=${v}`),
            })
            child.set(c, 0)
            root.sub(r, () => order.push("sub:r"))
            child.sub(c, () => order.push("sub:c"))

            child.txn(t => {
                t.set(c, 7)
                t.parentScope(pt => pt.set(r, 1))
            })

            // All onSets fire before any subscriber; within each group the
            // parent (root) precedes the child.
            expect(order).toEqual([
                "onSet:r=1",
                "onSet:c=7",
                "sub:r",
                "sub:c",
            ])
        })
    })
})
