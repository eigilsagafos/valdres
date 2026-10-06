// Transaction.resetAll(): an EXPLICITLY cleared scope restores parent
// inheritance in every collection, whether or not it owned rows there, and
// its later writes behave as in an untouched child of the restored parent.
// An UNCLEARED descendant keeps the accepted history-retaining behavior.
//
// root a,b,c,d; A hides b; C is A's child. In one transaction: clear A,
// (clear C), then C writes row a (presence-neutral). Final values and
// presence are equal across variants, so only the order is under test.
import { describe, expect, test } from "bun:test"
import { collection, store } from "../../src/index"
import { query } from "../../src/query"

type Row = { kind: "x"; key: string }
const keys = (rows: readonly { key: string }[]) => rows.map(row => row.key)
const row = (key: string): Row => ({ kind: "x", key })

const fixture = () => {
    const rows = collection<string, Row, string, { kind: Row["kind"] }>({
        indexes: { kind: row => row.kind },
    })
    const xs = query(rows, { where: { kind: { eq: "x" } } })
    const root = store()
    for (const key of ["a", "b", "c", "d"]) root.set(rows(key), row(key))
    return { rows, xs, root }
}

type Variant = "never-owned" | "value-override" | "untouched-reference"

/** Returns membership and indexed-query orders of C at each checkpoint. */
const run = (variant: Variant, clearC: boolean) => {
    const { rows, xs, root } = fixture()
    const A = root.scope("A")
    // the reference's A is already what the restored A reads: nothing hidden
    if (variant !== "untouched-reference") A.delete(rows("b"))
    const C = A.scope("C")
    if (variant === "value-override") C.set(rows("c"), row("c"))
    const seen: Record<string, { membership: string[]; query: string[] }> = {}
    let notified = 0
    const stop = C.sub(rows, () => notified++)
    const before = C.get(rows)
    root.txn(tx => {
        const a = tx.scope(A)
        const c = tx.scope(C)
        const read = (name: string) => {
            seen[name] = {
                membership: keys(c.get(rows)),
                query: keys(c.get(xs)),
            }
        }
        if (variant !== "untouched-reference") a.resetAll()
        read("after clear A")
        if (clearC && variant !== "untouched-reference") c.resetAll()
        read("after clear C")
        c.set(rows("a"), row("a"))
        read("after C writes a")
    })
    stop()
    seen["after commit"] = {
        membership: keys(C.get(rows)),
        query: keys(C.get(xs)),
    }
    const values = ["a", "b", "c", "d"].map(key => C.get(rows(key)))
    return { seen, values, notified, before, after: C.get(rows), C, root }
}

const checkpoints = [
    "after clear A",
    "after clear C",
    "after C writes a",
    "after commit",
]
const all = (order: string[]) =>
    Object.fromEntries(
        checkpoints.map(name => [name, { membership: order, query: order }]),
    )

describe("resetAll explicit-clear postcondition", () => {
    test("an explicitly cleared scope equals an untouched child of its restored parent, owned rows or not", () => {
        const reference = run("untouched-reference", true)
        const neverOwned = run("never-owned", true)
        const valueOverride = run("value-override", true)
        expect(reference.seen).toEqual(all(["a", "b", "c", "d"]))
        expect(neverOwned.seen).toEqual(reference.seen)
        expect(valueOverride.seen).toEqual(reference.seen)
        expect(neverOwned.values).toEqual(reference.values)
        expect(valueOverride.values).toEqual(reference.values)
    })

    test("control: an uncleared child that writes keeps its own order history", () => {
        const expected = {
            "after clear A": {
                membership: ["a", "b", "c", "d"],
                query: ["a", "b", "c", "d"],
            },
            "after clear C": {
                membership: ["a", "b", "c", "d"],
                query: ["a", "b", "c", "d"],
            },
            "after C writes a": {
                membership: ["a", "c", "d", "b"],
                query: ["a", "c", "d", "b"],
            },
            "after commit": {
                membership: ["a", "c", "d", "b"],
                query: ["a", "c", "d", "b"],
            },
        }
        for (const variant of ["never-owned", "value-override"] as const) {
            const control = run(variant, false)
            expect(control.seen).toEqual(expected)
            expect(control.values).toEqual(
                run("untouched-reference", true).values,
            )
        }
    })

    test("clear order does not matter: clearing C before A gives the same postcondition", () => {
        for (const owned of [false, true]) {
            const { rows, xs, root } = fixture()
            const A = root.scope("A")
            A.delete(rows("b"))
            const C = A.scope("C")
            if (owned) C.set(rows("c"), row("c"))
            let inTxn: string[] = []
            root.txn(tx => {
                tx.scope(C).resetAll()
                tx.scope(A).resetAll()
                tx.scope(C).set(rows("a"), row("a"))
                inTxn = keys(tx.scope(C).get(rows))
            })
            expect(inTxn).toEqual(["a", "b", "c", "d"])
            expect(keys(C.get(rows))).toEqual(["a", "b", "c", "d"])
            expect(keys(C.get(xs))).toEqual(["a", "b", "c", "d"])
        }
    })

    test("a grandchild cleared below a following middle restores the same way", () => {
        const { rows, xs, root } = fixture()
        const A = root.scope("A")
        A.delete(rows("b"))
        const M = A.scope("M") // never written: follows A
        const C = M.scope("C") // never written either
        root.txn(tx => {
            tx.scope(A).resetAll()
            tx.scope(C).resetAll()
            tx.scope(C).set(rows("a"), row("a"))
        })
        expect(keys(M.get(rows))).toEqual(["a", "b", "c", "d"])
        expect(keys(C.get(rows))).toEqual(["a", "b", "c", "d"])
        expect(keys(C.get(xs))).toEqual(["a", "b", "c", "d"])
    })

    test("unchanged results: clearing a never-owning child publishes nothing extra and reuses arrays", () => {
        // C cleared but never writes: its served rows equal the follower's,
        // so it is notified once (b revealed) exactly like an uncleared C.
        const counts = [true, false].map(clearC => {
            const { rows, root } = fixture()
            const A = root.scope("A")
            A.delete(rows("b"))
            const C = A.scope("C")
            const D = root.scope("D") // unrelated sibling
            const dRows = D.get(rows)
            let c = 0
            let d = 0
            const stopC = C.sub(rows, () => c++)
            const stopD = D.sub(rows, () => d++)
            root.txn(tx => {
                tx.scope(A).resetAll()
                if (clearC) tx.scope(C).resetAll()
            })
            stopC()
            stopD()
            expect(keys(C.get(rows))).toEqual(["a", "b", "c", "d"])
            expect(D.get(rows)).toBe(dRows)
            return { c, d }
        })
        expect(counts[0]).toEqual({ c: 1, d: 0 })
        expect(counts[1]).toEqual(counts[0])

        // with no restored ancestor, clearing a never-owning scope is a no-op
        const { rows, root } = fixture()
        const C = root.scope("A").scope("C")
        const before = C.get(rows)
        let notified = 0
        const stop = C.sub(rows, () => notified++)
        root.txn(tx => tx.scope(C).resetAll())
        stop()
        expect(C.get(rows)).toBe(before)
        expect(notified).toBe(0)
    })

    test("an order that moved within one transaction (delete, then reset) is restored by a later clear", () => {
        const { rows, xs, root } = fixture()
        const A = root.scope("A")
        const B = A.scope("B")
        root.txn(tx => {
            tx.scope(B).delete(rows("b"))
            tx.scope(B).reset(rows("b"))
        })
        // no ownership remains, but B's order now has its own history
        expect(keys(B.get(rows))).toEqual(["a", "c", "d", "b"])
        expect(keys(A.get(rows))).toEqual(["a", "b", "c", "d"])
        let inTxn: string[] = []
        root.txn(tx => {
            tx.scope(B).resetAll()
            inTxn = keys(tx.scope(B).get(rows))
        })
        expect(inTxn).toEqual(["a", "b", "c", "d"])
        expect(keys(B.get(rows))).toEqual(["a", "b", "c", "d"])
        expect(keys(B.get(xs))).toEqual(["a", "b", "c", "d"])
    })

    test("an uncleared writer keeps its order whether or not anything read it", () => {
        // C stages events that cancel out (set, then reset). Under the
        // descendant rule it keeps its own order below the restored A; the
        // result must not depend on whether C was read in the transaction.
        for (const readC of [false, true]) {
            const { rows, xs, root } = fixture()
            const A = root.scope("A")
            A.delete(rows("b"))
            A.set(rows("b"), row("b"))
            const C = A.scope("C")
            let inTxn: string[] = []
            root.txn(tx => {
                tx.scope(C).set(rows("b"), row("b"))
                tx.scope(C).reset(rows("b"))
                tx.scope(A).resetAll()
                if (readC) inTxn = keys(tx.scope(C).get(rows))
            })
            if (readC) expect(inTxn).toEqual(["a", "c", "d", "b"])
            expect(keys(A.get(rows))).toEqual(["a", "b", "c", "d"])
            expect(keys(C.get(rows))).toEqual(["a", "c", "d", "b"])
            expect(keys(C.get(xs))).toEqual(["a", "c", "d", "b"])
            // and its kept order is its own: clearing it restores A's
            root.txn(tx => tx.scope(C).resetAll())
            expect(keys(C.get(rows))).toEqual(["a", "b", "c", "d"])
        }
    })
})
