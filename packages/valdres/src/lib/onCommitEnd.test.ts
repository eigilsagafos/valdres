import { describe, expect, mock, test } from "bun:test"
import { atom } from "../atom"
import { atomFamily } from "../atomFamily"
import { selector } from "../selector"
import { store } from "../store"

describe("store.onCommitEnd", () => {
    test("plain set: fires exactly once, strictly after subscribers and onChange", () => {
        const store1 = store()
        const a = atom(0)
        const events: string[] = []
        store1.sub(a, () => events.push("subscriber"))
        const unsubChange = store1.onChange(() => events.push("onChange"))
        const unsub = store1.onCommitEnd(() => events.push("commit-end"))
        store1.set(a, 1)
        expect(events).toEqual(["subscriber", "onChange", "commit-end"])
        unsub()
        unsubChange()
    })

    test("each standalone set is its own commit", () => {
        const store1 = store()
        const a = atom(0)
        const fired = mock(() => {})
        const unsub = store1.onCommitEnd(fired)
        store1.set(a, 1)
        store1.set(a, 2)
        expect(fired).toHaveBeenCalledTimes(2)
        unsub()
    })

    test("a no-op set (equal value) does not commit, so it does not fire", () => {
        const store1 = store()
        const a = atom(1)
        const fired = mock(() => {})
        const unsub = store1.onCommitEnd(fired)
        store1.set(a, 1)
        expect(fired).toHaveBeenCalledTimes(0)
        unsub()
    })

    test("store.txn: multi-atom commit fires once, after all subscribers", () => {
        const store1 = store()
        const a = atom(0)
        const b = atom(0)
        const events: string[] = []
        store1.sub(a, () => events.push("sub-a"))
        store1.sub(b, () => events.push("sub-b"))
        const unsub = store1.onCommitEnd(() => events.push("commit-end"))
        store1.txn(txn => {
            txn.set(a, 1)
            txn.set(b, 2)
        })
        expect(events.filter(e => e === "commit-end")).toHaveLength(1)
        expect(events[events.length - 1]).toBe("commit-end")
        expect(events).toContain("sub-a")
        expect(events).toContain("sub-b")
        unsub()
    })

    test("txn with family writes and a delete fires once", () => {
        const fam = atomFamily<number, [string]>(0)
        const store1 = store()
        store1.set(fam("x"), 1)
        const fired = mock(() => {})
        const unsub = store1.onCommitEnd(fired)
        store1.txn(txn => {
            txn.set(fam("y"), 2)
            txn.del(fam("x"))
        })
        expect(fired).toHaveBeenCalledTimes(1)
        unsub()
    })

    test("batched store: one microtask flush is one commit", async () => {
        const store1 = store({ batchUpdates: true })
        const a = atom(0)
        const b = atom(0)
        const events: string[] = []
        store1.sub(a, () => events.push("sub-a"))
        store1.sub(b, () => events.push("sub-b"))
        const unsub = store1.onCommitEnd(() => events.push("commit-end"))
        store1.set(a, 1)
        store1.set(b, 2)
        expect(events).toEqual([]) // nothing until the microtask flush
        await new Promise(resolve => setTimeout(resolve, 0))
        expect(events.filter(e => e === "commit-end")).toHaveLength(1)
        expect(events[events.length - 1]).toBe("commit-end")
        unsub()
    })

    test("reset, unset, and del each fire once", () => {
        const store1 = store()
        const a = atom(0)
        const fam = atomFamily<number, [string]>(0)
        store1.set(a, 1)
        store1.set(fam("k"), 1)
        const fired = mock(() => {})
        const unsub = store1.onCommitEnd(fired)
        store1.reset(a)
        expect(fired).toHaveBeenCalledTimes(1)
        store1.set(a, 2)
        expect(fired).toHaveBeenCalledTimes(2)
        store1.unset(a)
        expect(fired).toHaveBeenCalledTimes(3)
        store1.del(fam("k"))
        expect(fired).toHaveBeenCalledTimes(4)
        unsub()
    })

    test("unset with no own value is a no-op and does not fire", () => {
        const store1 = store()
        const a = atom(0)
        const fired = mock(() => {})
        const unsub = store1.onCommitEnd(fired)
        store1.unset(a)
        expect(fired).toHaveBeenCalledTimes(0)
        unsub()
    })

    test("writes performed by subscribers coalesce into the outer commit's single fire", () => {
        const store1 = store()
        const a = atom(0)
        const b = atom(0)
        const events: string[] = []
        let cascaded = false
        store1.sub(a, () => {
            events.push("sub-a")
            if (!cascaded) {
                cascaded = true
                store1.set(b, 99) // nested write during the commit
            }
        })
        store1.sub(b, () => events.push("sub-b"))
        const unsub = store1.onCommitEnd(() => events.push("commit-end"))
        store1.set(a, 1)
        expect(events).toEqual(["sub-a", "sub-b", "commit-end"])
        expect(store1.get(b)).toBe(99)
        unsub()
    })

    // Scope delegation semantics, pinned: listeners live on the store TREE
    // (attached to its root), and any commit in the tree fires them.
    describe("scoped stores", () => {
        test("a root-registered listener fires for a scope-local write", () => {
            const root = store()
            const scoped = root.scope("ce-s1")
            const a = atom(0)
            const fired = mock(() => {})
            const unsub = root.onCommitEnd(fired)
            scoped.set(a, 1)
            expect(fired).toHaveBeenCalledTimes(1)
            unsub()
            scoped.detach()
        })

        test("a scope-registered listener fires for a root write", () => {
            const root = store()
            const scoped = root.scope("ce-s2")
            const a = atom(0)
            const fired = mock(() => {})
            const unsub = scoped.onCommitEnd(fired)
            root.set(a, 1)
            expect(fired).toHaveBeenCalledTimes(1)
            unsub()
            scoped.detach()
        })

        test("a cross-scope txn is one commit, fired after subscribers in both stores", () => {
            const root = store()
            const scoped = root.scope("ce-s3")
            const a = atom(0)
            const b = atom(0)
            scoped.set(b, 0) // shadow b in the scope
            const events: string[] = []
            root.sub(a, () => events.push("sub-root"))
            scoped.sub(b, () => events.push("sub-scope"))
            const unsubRoot = root.onCommitEnd(() => events.push("end-root"))
            const unsubScoped = scoped.onCommitEnd(() =>
                events.push("end-scope"),
            )
            root.txn(txn => {
                txn.set(a, 1)
                txn.scope("ce-s3", scopedTxn => scopedTxn.set(b, 2))
            })
            // both subscribers first, then each listener exactly once
            expect(events.slice(0, 2).sort()).toEqual([
                "sub-root",
                "sub-scope",
            ])
            expect(events.slice(2).sort()).toEqual(["end-root", "end-scope"])
            unsubRoot()
            unsubScoped()
            scoped.detach()
        })

        test("an unrelated root store's commit does not fire this tree's listeners", () => {
            const store1 = store()
            const store2 = store()
            const a = atom(0)
            const fired = mock(() => {})
            const unsub = store1.onCommitEnd(fired)
            store2.set(a, 1)
            expect(fired).toHaveBeenCalledTimes(0)
            unsub()
        })
    })

    test("unsubscribe stops firing; other listeners keep firing", () => {
        const store1 = store()
        const a = atom(0)
        const first = mock(() => {})
        const second = mock(() => {})
        const unsubFirst = store1.onCommitEnd(first)
        const unsubSecond = store1.onCommitEnd(second)
        store1.set(a, 1)
        unsubFirst()
        store1.set(a, 2)
        expect(first).toHaveBeenCalledTimes(1)
        expect(second).toHaveBeenCalledTimes(2)
        unsubFirst() // double-unsubscribe is a no-op
        store1.set(a, 3)
        expect(second).toHaveBeenCalledTimes(3)
        unsubSecond()
    })

    test("fires even when a subscriber throws; the subscriber error still propagates", () => {
        const store1 = store()
        const a = atom(0)
        const fired = mock(() => {})
        store1.sub(a, () => {
            throw new Error("subscriber boom")
        })
        const unsub = store1.onCommitEnd(fired)
        expect(() => store1.set(a, 1)).toThrow("subscriber boom")
        expect(fired).toHaveBeenCalledTimes(1)
        expect(store1.get(a)).toBe(1) // the write was applied
        unsub()
    })

    test("a throwing listener surfaces its error without starving other listeners", () => {
        const store1 = store()
        const a = atom(0)
        const second = mock(() => {})
        const unsubThrowing = store1.onCommitEnd(() => {
            throw new Error("listener boom")
        })
        const unsubSecond = store1.onCommitEnd(second)
        expect(() => store1.set(a, 1)).toThrow("listener boom")
        expect(second).toHaveBeenCalledTimes(1)
        unsubThrowing()
        unsubSecond()
    })

    test("selector subscribers also precede the commit-end fire", () => {
        const store1 = store()
        const a = atom(1)
        const double = selector(get => get(a) * 2)
        const events: string[] = []
        store1.sub(double, () => events.push("sub-selector"))
        const unsub = store1.onCommitEnd(() => events.push("commit-end"))
        store1.set(a, 2)
        expect(events).toEqual(["sub-selector", "commit-end"])
        unsub()
    })
})
