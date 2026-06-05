import { describe, expect, mock, test } from "bun:test"
import { atom } from "../atom"
import { atomFamily } from "../atomFamily"
import { selector } from "../selector"
import { store } from "../store"

// A deferred (multi-pass) commit accumulates subscribers per store and fires
// them once at the very end via notifyDeferred → callSubscribers. This pins
// what happens when one of those subscribers THROWS. Two deferred paths are
// covered: (a) a cross-scope txn (root + a scope via t.scope), and (b) a
// single-store update+delete txn (t.set + t.del of a family member).
//
// The contracts pinned here (all observed by probing the real implementation,
// not guessed):
//   1. WRITES ARE FULLY APPLIED even though a subscriber throws. The throw
//      happens in the notify phase, after every write across every store. Final
//      atom/selector reads return the committed values.
//   2. WITHIN ONE STORE'S SUBSCRIBER SET, a throwing subscriber does NOT prevent
//      the OTHER subscribers in that same set from firing (callSubscribers
//      catches each throw, records the FIRST error, keeps firing the rest), and
//      the txn ultimately throws that first error.
//   3. CROSS-ENTRY: notifyDeferred fires EVERY store's entry even if one throws,
//      then rethrows the FIRST error. So a throwing subscriber in one store
//      (e.g. root, processed first) does NOT suppress another store's (scope's)
//      subscribers for writes committed in the same atomic transaction — every
//      store is notified, and the first error still surfaces from the txn.

describe("deferred commit: a subscriber that throws", () => {
    describe("(a) cross-scope txn (root + scope)", () => {
        test("writes are fully applied even though a subscriber throws", () => {
            const root = store()
            const S = root.scope("S")
            const r = atom(1, { name: "dce-a-r" })
            const s = atom(10, { name: "dce-a-s" })
            S.set(s, 10)

            // Subscriber on the root atom throws during the notify phase.
            root.sub(r, () => {
                throw new Error("boom-a-1")
            })

            expect(() =>
                root.txn(t => {
                    t.set(r, 2)
                    t.scope("S", st => st.set(s, 20))
                }),
            ).toThrow("boom-a-1")

            // The throw is in the notify phase, AFTER all writes — so both the
            // root and scope values are the committed ones.
            expect(root.get(r)).toBe(2)
            expect(S.get(s)).toBe(20)
        })

        test("a spanning selector reaches its committed value despite a throw", () => {
            const root = store()
            const S = root.scope("S")
            const r = atom(1, { name: "dce-a2-r" })
            const s = atom(10, { name: "dce-a2-s" })
            S.set(s, 10)

            const sum = selector(get => get(r) + get(s), { name: "dce-a2-sum" })
            // Subscribe to the spanning selector in the scope; the callback throws.
            S.sub(sum, () => {
                throw new Error("boom-a2")
            })
            expect(S.get(sum)).toBe(11)

            expect(() =>
                root.txn(t => {
                    t.set(r, 2)
                    t.scope("S", st => st.set(s, 20))
                }),
            ).toThrow("boom-a2")

            // Final committed value is observable after the commit, despite the
            // subscriber throwing.
            expect(S.get(sum)).toBe(22)
        })

        test("within one store's set, a throwing subscriber does not stop the others; txn throws the first error", () => {
            const root = store()
            const S = root.scope("S")
            const r = atom(1, { name: "dce-a3-r" })
            const s = atom(10, { name: "dce-a3-s" })
            S.set(s, 10)

            const order: string[] = []
            const sub1 = mock(() => {
                order.push("sub1")
                throw new Error("boom-a3-first")
            })
            const sub2 = mock(() => {
                order.push("sub2")
            })
            const sub3 = mock(() => {
                order.push("sub3")
                throw new Error("boom-a3-second")
            })
            // All three on the SAME store (root), SAME atom => one subscriber set.
            root.sub(r, sub1)
            root.sub(r, sub2)
            root.sub(r, sub3)

            let thrown: unknown
            try {
                root.txn(t => {
                    t.set(r, 2)
                    t.scope("S", st => st.set(s, 20))
                })
            } catch (e) {
                thrown = e
            }

            // Every subscriber in the set fired, in registration order.
            expect(sub1).toHaveBeenCalledTimes(1)
            expect(sub2).toHaveBeenCalledTimes(1)
            expect(sub3).toHaveBeenCalledTimes(1)
            expect(order).toEqual(["sub1", "sub2", "sub3"])

            // The txn rethrows the FIRST error encountered (not the last).
            expect(thrown).toBeInstanceOf(Error)
            expect((thrown as Error).message).toBe("boom-a3-first")
        })
    })

    describe("(b) single-store update+delete txn (t.set + t.del)", () => {
        test("writes are fully applied (atom set + family delete) despite a throw", () => {
            const root = store()
            const fam = atomFamily<string>(undefined, { name: "dce-b-fam" })
            const m1 = fam("1")
            const m2 = fam("2")
            root.set(m1, "a")
            root.set(m2, "b")
            const Y = atom(0, { name: "dce-b-y" })

            const span = selector(get => `${get(fam).length}:${get(Y)}`, {
                name: "dce-b-span",
            })
            root.sub(span, () => {
                throw new Error("boom-b")
            })
            expect(root.get(span)).toBe("2:0")

            expect(() =>
                root.txn(t => {
                    t.del(m2)
                    t.set(Y, 9)
                }),
            ).toThrow("boom-b")

            // Both the delete and the set landed, observable after the throw.
            expect(root.get(span)).toBe("1:9")
            expect(root.get(Y)).toBe(9)
            // The deleted member's value is actually evicted from the store.
            expect(root.data.values.has(m2)).toBe(false)
        })

        test("within one store's set, a throwing subscriber does not stop the others; txn throws the first error", () => {
            const root = store()
            const fam = atomFamily<string>(undefined, { name: "dce-b2-fam" })
            const m1 = fam("1")
            const m2 = fam("2")
            root.set(m1, "a")
            root.set(m2, "b")
            const Y = atom(0, { name: "dce-b2-y" })

            const span = selector(get => `${get(fam).length}:${get(Y)}`, {
                name: "dce-b2-span",
            })

            const spanSub1 = mock(() => {
                throw new Error("boom-b2-first")
            })
            const spanSub2 = mock(() => {})
            // Subscriber on Y too — Y is updated in the same deferred commit.
            const ySub = mock(() => {})
            root.sub(span, spanSub1)
            root.sub(span, spanSub2)
            root.sub(Y, ySub)
            root.get(span)

            let thrown: unknown
            try {
                root.txn(t => {
                    t.del(m2)
                    t.set(Y, 9)
                })
            } catch (e) {
                thrown = e
            }

            // Both span subscribers fired even though the first threw, and the
            // unrelated Y subscriber in the same store fired too.
            expect(spanSub1).toHaveBeenCalledTimes(1)
            expect(spanSub2).toHaveBeenCalledTimes(1)
            expect(ySub).toHaveBeenCalledTimes(1)

            // Txn rethrows the first error.
            expect(thrown).toBeInstanceOf(Error)
            expect((thrown as Error).message).toBe("boom-b2-first")
        })
    })

    // CROSS-ENTRY behavior. notifyDeferred fires every per-store entry (root
    // first, then scopes); if an entry's callSubscribers rethrows, the loop
    // records the first error and CONTINUES to the remaining entries, rethrowing
    // the first error only at the end. So a throw in one store's entry does not
    // suppress another store's notification for the same atomic commit.
    describe("cross-entry: a throw in one store's entry does NOT suppress others", () => {
        test("ROOT-entry throw still notifies the SCOPE-entry subscriber; first error surfaces", () => {
            const root = store()
            const S = root.scope("S")
            const r = atom(1, { name: "dce-ce-r" })
            const s = atom(10, { name: "dce-ce-s" })
            S.set(s, 10)

            const rootSub = mock(() => {
                throw new Error("boom-root-entry")
            })
            const scopeSub = mock(() => {})
            // Root entry is processed first (root-first); it throws.
            root.sub(r, rootSub)
            // Scope entry is processed AFTER root.
            S.sub(s, scopeSub)

            expect(() =>
                root.txn(t => {
                    t.set(r, 2)
                    t.scope("S", st => st.set(s, 20))
                }),
            ).toThrow("boom-root-entry")

            // Root entry fired (and threw)...
            expect(rootSub).toHaveBeenCalledTimes(1)
            // ...and the SCOPE entry subscriber is STILL notified — notifyDeferred
            // fires every store's entry even when an earlier one throws, then
            // rethrows the first (root) error.
            expect(scopeSub).toHaveBeenCalledTimes(1)

            expect(S.get(s)).toBe(20)
            expect(root.get(r)).toBe(2)
        })

        test("SCOPE-entry throw does NOT suppress the earlier ROOT-entry subscriber", () => {
            // Root is processed before the scope (root-first), so a scope throw
            // cannot retroactively suppress the root entry — it already fired.
            const root = store()
            const S = root.scope("S")
            const r = atom(1, { name: "dce-ce2-r" })
            const s = atom(10, { name: "dce-ce2-s" })
            S.set(s, 10)

            const rootSub = mock(() => {})
            const scopeSub = mock(() => {
                throw new Error("boom-scope-entry")
            })
            root.sub(r, rootSub)
            S.sub(s, scopeSub)

            expect(() =>
                root.txn(t => {
                    t.set(r, 2)
                    t.scope("S", st => st.set(s, 20))
                }),
            ).toThrow("boom-scope-entry")

            // Both fired: root (first, cleanly) then scope (which threw).
            expect(rootSub).toHaveBeenCalledTimes(1)
            expect(scopeSub).toHaveBeenCalledTimes(1)
        })
    })
})
