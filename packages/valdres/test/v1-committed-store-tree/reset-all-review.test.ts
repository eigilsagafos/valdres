// Transaction.resetAll(): regressions for independent-review blockers B1–B4 plus
// focused combinations. Expected results are derived by hand from the
// documented semantics (untouched-child equivalence for cleared scopes and
// their mirroring descendants; the existing per-row rule for history-keeping
// descendants); per-state reset loops are NOT used as an oracle.
import { describe, expect, test } from "bun:test"
import { atom, collection, store } from "../../src/index"
import { query } from "../../src/query"

type Row = { kind: "yes" | "no"; key: string }
const y = (key: string): Row => ({ kind: "yes", key })
const keys = (rows: readonly { key: unknown }[]) =>
    rows.map(r => r.key).join(",")

const fixture = (initial = ["a", "b", "c"]) => {
    const rows = collection<string, Row, string, { kind: Row["kind"] }>({
        indexes: { kind: v => v.kind },
    })
    const selected = query(rows, { where: { kind: { eq: "yes" } } })
    const root = store()
    const values = new Map<string, Row>()
    for (const k of initial) {
        const v: Row = { kind: "yes", key: k }
        values.set(k, v)
        root.set(rows(k), v)
    }
    return { rows, selected, root, values }
}

/** Presence, membership and indexed query must tell one story. */
const coherent = (
    view: { get: (s: any) => any },
    rows: any,
    selected: any,
    universe: readonly string[],
) => {
    const membership = view.get(rows) as { key: string }[]
    const present = universe.filter(k => view.get(rows(k)) !== undefined)
    expect([...membership.map(r => r.key)].sort()).toEqual([...present].sort())
    const expectedQuery = membership
        .filter(r => (view.get(rows(r.key)) as Row).kind === "yes")
        .map(r => r.key)
        .join(",")
    expect(keys(view.get(selected))).toBe(expectedQuery)
    return keys(membership)
}

describe("resetAll review blockers", () => {
    test("B1: discarded staged delete/set does not re-rank the restored indexed order", () => {
        const { rows, selected, root, values } = fixture(["a", "b"])
        const draft = root.scope("draft")
        const child = draft.scope("child")
        let notifications = 0
        draft.sub(selected, () => notifications++)
        child.sub(selected, () => notifications++)
        const before = draft.get(selected)
        root.txn(tx => {
            const c = tx.scope(draft)
            c.delete(rows("a"))
            c.set(rows("a"), y("staged-a"))
            c.resetAll()
            expect(keys(c.get(rows))).toBe("a,b")
            expect(keys(c.get(selected))).toBe("a,b")
        })
        expect(keys(draft.get(rows))).toBe("a,b")
        expect(keys(draft.get(selected))).toBe("a,b")
        expect(keys(child.get(rows))).toBe("a,b")
        expect(keys(child.get(selected))).toBe("a,b")
        expect(draft.get(selected)).toBe(before) // unchanged result keeps identity
        expect(draft.get(rows("a"))).toBe(values.get("a")!)
        expect(notifications).toBe(0)
        // later parent insert ranks after restored rows in every view
        root.set(rows("z"), y("z"))
        expect(keys(draft.get(selected))).toBe("a,b,z")
        expect(keys(child.get(selected))).toBe("a,b,z")
    })

    test("B1 variant: discarded staged history with a membership change still ranks by the restored order", () => {
        const { rows, selected, root } = fixture(["a", "b", "c"])
        const draft = root.scope("draft")
        draft.delete(rows("b")) // committed: a,c
        draft.sub(selected, () => {})
        root.txn(tx => {
            const c = tx.scope(draft)
            c.delete(rows("a"))
            c.set(rows("a"), y("staged-a")) // pre-clear birth of a
            c.resetAll()
        })
        expect(keys(draft.get(rows))).toBe("a,b,c")
        expect(keys(draft.get(selected))).toBe("a,b,c")
    })

    test("B2: explicitly cleared leaf below a following middle inherits the middle's current view", () => {
        const { rows, selected, root } = fixture()
        const ancestor = root.scope("ancestor")
        ancestor.delete(rows("b"))
        const middle = ancestor.scope("middle") // never written: follows ancestor
        const leaf = middle.scope("leaf")
        leaf.set(rows("extra"), y("extra"))
        leaf.sub(selected, () => {})
        const seen: string[] = []
        leaf.sub(rows, () =>
            seen.push(`${keys(leaf.get(rows))}|${keys(leaf.get(selected))}`),
        )
        root.txn(tx => {
            tx.scope(ancestor).resetAll()
            tx.scope(leaf).resetAll()
            const l = tx.scope(leaf)
            expect(coherent(l, rows, selected, ["a", "b", "c", "extra"])).toBe(
                "a,b,c",
            )
            expect(keys(tx.scope(middle).get(rows))).toBe("a,b,c")
        })
        expect(coherent(leaf, rows, selected, ["a", "b", "c", "extra"])).toBe(
            "a,b,c",
        )
        expect(seen).toEqual(["a,b,c|a,b,c"])
        root.set(rows("late"), y("late"))
        expect(keys(middle.get(rows))).toBe("a,b,c,late")
        expect(
            coherent(leaf, rows, selected, ["a", "b", "c", "extra", "late"]),
        ).toBe("a,b,c,late")
    })

    test("B2 order-only: cleared leaf with residue below a following middle takes the restored order", () => {
        const { rows, selected, root } = fixture()
        const ancestor = root.scope("ancestor")
        ancestor.delete(rows("a"))
        ancestor.reset(rows("a")) // ancestor residue: b,c,a
        const middle = ancestor.scope("middle")
        const leaf = middle.scope("leaf")
        leaf.delete(rows("b"))
        leaf.reset(rows("b")) // leaf residue: c,a,b
        expect(keys(leaf.get(rows))).toBe("c,a,b")
        root.txn(tx => {
            tx.scope(ancestor).resetAll()
            tx.scope(leaf).resetAll()
            expect(
                coherent(tx.scope(leaf), rows, selected, ["a", "b", "c"]),
            ).toBe("a,b,c")
        })
        expect(keys(middle.get(rows))).toBe("a,b,c")
        expect(coherent(leaf, rows, selected, ["a", "b", "c"])).toBe("a,b,c")
    })

    test("B2 with a history-keeping middle: the cleared leaf equals the middle's per-row result", () => {
        const { rows, selected, root } = fixture()
        const ancestor = root.scope("ancestor")
        ancestor.delete(rows("b"))
        const middle = ancestor.scope("middle")
        middle.set(rows("m"), y("m")) // middle owns membership: a,c,m
        const leaf = middle.scope("leaf")
        leaf.delete(rows("a")) // leaf: c,m
        root.txn(tx => {
            tx.scope(ancestor).resetAll()
            tx.scope(leaf).resetAll()
            // middle keeps its own history: b is revealed as a birth -> a,c,m,b
            expect(keys(tx.scope(middle).get(rows))).toBe("a,c,m,b")
            expect(
                coherent(tx.scope(leaf), rows, selected, ["a", "b", "c", "m"]),
            ).toBe("a,c,m,b")
        })
        expect(keys(middle.get(rows))).toBe("a,c,m,b")
        expect(coherent(leaf, rows, selected, ["a", "b", "c", "m"])).toBe(
            "a,c,m,b",
        )
    })

    test("B3: a query read before an order-only clear is invalidated in the transaction", () => {
        const { rows, selected, root } = fixture()
        const draft = root.scope("draft")
        draft.delete(rows("a"))
        draft.reset(rows("a")) // residue b,c,a; no ownership
        root.txn(tx => {
            const c = tx.scope(draft)
            expect(keys(c.get(selected))).toBe("b,c,a")
            c.resetAll()
            expect(keys(c.get(rows))).toBe("a,b,c")
            expect(keys(c.get(selected))).toBe("a,b,c")
        })
        expect(keys(draft.get(selected))).toBe("a,b,c")
    })

    test("B4: a presence-neutral staged child write switches it to its own history immediately", () => {
        const { rows, selected, root } = fixture(["a", "b"])
        const draft = root.scope("draft")
        draft.delete(rows("a"))
        draft.reset(rows("a")) // residue b,a
        const child = draft.scope("child")
        const grandchild = child.scope("grandchild") // never written
        let duringTxn = ""
        root.txn(tx => {
            tx.scope(draft).resetAll()
            const c = tx.scope(child)
            expect(keys(c.get(rows))).toBe("a,b") // still mirroring the restored draft
            expect(keys(c.scope(grandchild).get(rows))).toBe("a,b")
            c.set(rows("a"), y("child-a"))
            // documented policy: staged collection history => own (b,a) order
            duringTxn = `${keys(c.get(rows))}|${keys(c.get(selected))}`
            // the never-written grandchild now mirrors the child, not the draft
            expect(keys(c.scope(grandchild).get(rows))).toBe("b,a")
            expect(keys(c.scope(grandchild).get(selected))).toBe("b,a")
        })
        expect(
            `${keys(grandchild.get(rows))}|${keys(grandchild.get(selected))}`,
        ).toBe("b,a|b,a")
        expect(duringTxn).toBe("b,a|b,a")
        expect(`${keys(child.get(rows))}|${keys(child.get(selected))}`).toBe(
            duringTxn,
        )
        expect(keys(draft.get(rows))).toBe("a,b")
        expect((child.get(rows("a")) as Row).key).toBe("child-a")
    })

    test("combination: repeated clears with pre/post staged writes and cached queries", () => {
        const { rows, selected, root } = fixture(["a", "b", "c", "d"])
        const draft = root.scope("draft")
        draft.delete(rows("b"))
        draft.delete(rows("d"))
        draft.reset(rows("d")) // committed: a,c,d (d residue at the end is a no-op here)
        const ro = draft.scope("read-only")
        ro.sub(selected, () => {})
        root.txn(tx => {
            const c = tx.scope(draft)
            c.get(selected)
            c.delete(rows("c")) // discarded by the first clear
            c.resetAll()
            expect(keys(c.get(selected))).toBe("a,b,c,d")
            c.set(rows("x"), y("x")) // discarded by the second clear
            tx.set(rows("p"), y("p")) // parent birth between clears
            c.get(selected)
            c.resetAll()
            c.set(rows("y"), y("y")) // survives
            tx.delete(rows("a")) // parent removal after the second clear
            expect(
                coherent(c, rows, selected, [
                    "a",
                    "b",
                    "c",
                    "d",
                    "p",
                    "x",
                    "y",
                ]),
            ).toBe("b,c,d,p,y")
            expect(
                coherent(tx.scope(ro), rows, selected, [
                    "a",
                    "b",
                    "c",
                    "d",
                    "p",
                    "x",
                    "y",
                ]),
            ).toBe("b,c,d,p,y")
        })
        expect(
            coherent(draft, rows, selected, [
                "a",
                "b",
                "c",
                "d",
                "p",
                "x",
                "y",
            ]),
        ).toBe("b,c,d,p,y")
        expect(
            coherent(ro, rows, selected, ["a", "b", "c", "d", "p", "x", "y"]),
        ).toBe("b,c,d,p,y")
    })

    test("combination: leaf cleared before its ancestor, two intervening read-only scopes", () => {
        const { rows, selected, root } = fixture()
        const ancestor = root.scope("ancestor")
        ancestor.delete(rows("c"))
        const m1 = ancestor.scope("m1")
        const m2 = m1.scope("m2")
        const leaf = m2.scope("leaf")
        leaf.delete(rows("a"))
        for (const s of [m1, m2, leaf]) s.sub(selected, () => {})
        root.txn(tx => {
            tx.scope(leaf).resetAll() // leaf first: still sees ancestor's c deletion
            expect(keys(tx.scope(leaf).get(rows))).toBe("a,b")
            tx.scope(ancestor).resetAll()
            for (const s of [m1, m2, leaf])
                expect(
                    coherent(tx.scope(s), rows, selected, ["a", "b", "c"]),
                ).toBe("a,b,c")
        })
        for (const s of [ancestor, m1, m2, leaf])
            expect(coherent(s, rows, selected, ["a", "b", "c"])).toBe("a,b,c")
    })

    test("single-state reset semantics and descendant-owned values are unchanged", () => {
        const { rows, selected, root } = fixture()
        const draft = root.scope("draft")
        draft.delete(rows("b"))
        draft.reset(rows("b"))
        expect(keys(draft.get(rows))).toBe("a,c,b")
        const owner = draft.scope("owner")
        const own = y("own-a")
        owner.set(rows("a"), own)
        owner.set(rows("n"), y("n"))
        root.txn(tx => tx.scope(draft).resetAll())
        expect(keys(draft.get(rows))).toBe("a,b,c")
        expect(owner.get(rows("a"))).toBe(own)
        expect(coherent(owner, rows, selected, ["a", "b", "c", "n"])).toBe(
            "a,c,b,n",
        )
        const x = atom(0)
        draft.set(x, 1)
        root.txn(tx => tx.scope(draft).resetAll())
        expect(draft.get(x)).toBe(0)
    })

    test("seeded nested oracle: cleared and never-written scopes equal an untouched parallel tree", () => {
        let checked = 0
        for (let seed = 1; seed <= 300; seed++) checked += nestedOracle(seed)
        expect(checked).toBeGreaterThan(600)
    })
})

const rng = (seed: number) => {
    let state = seed >>> 0
    return (n: number) => {
        state = (Math.imul(state, 1103515245) + 12345) >>> 0
        return (state >>> 16) % n
    }
}

/**
 * Tree X: anc -> mid (never written) -> leaf, with random committed history on
 * anc and (optionally) leaf. Tree R: the same shape, never written. One
 * transaction: random root writes, clear anc and/or leaf in X (a leaf that is
 * not cleared is kept never-written), cached draft query reads, and identical
 * post-clear writes on X and R. Every compared X scope must equal its R twin
 * inside the transaction (after the last write) and after commit, and every
 * scope must be presence/membership/query coherent.
 */
const nestedOracle = (seed: number): number => {
    const rand = rng(seed)
    const universe = ["a", "b", "c", "d", "e", "f"]
    const { rows, selected, root } = fixture(
        universe.filter(() => rand(3) !== 0),
    )
    const value = (k: string): Row => ({
        kind: rand(4) === 0 ? "no" : "yes",
        key: k,
    })
    const tree = (name: string) => {
        const anc = root.scope(`${name}-anc`)
        const mid = anc.scope("mid")
        const leaf = mid.scope("leaf")
        return { anc, mid, leaf }
    }
    const X = tree("x")
    const R = tree("r")
    /** One random write, returned so it can be applied to several targets. */
    const randomOp = () => {
        const k = universe[rand(universe.length)]!
        const op = rand(4)
        const v = value(k)
        return (s: any) =>
            op === 0
                ? s.delete(rows(k))
                : op === 1
                  ? s.reset(rows(k))
                  : s.set(rows(k), v)
    }
    const historyOp = (s: any) => randomOp()(s)
    const leafCleared = rand(2) === 0
    const clearAnc = !leafCleared || rand(2) === 0
    for (let i = 0; i < 8; i++) {
        const op = randomOp()
        op(X.anc)
        // an ancestor that is NOT cleared keeps its history: give the
        // reference ancestor the same committed state
        if (!clearAnc) op(R.anc)
    }
    if (leafCleared) for (let i = 0; i < 4; i++) historyOp(X.leaf)
    for (const t of [X, R])
        for (const s of [t.anc, t.mid, t.leaf]) {
            s.get(rows)
            s.get(selected)
        }
    const postOps: Array<(c: any) => void> = []
    const recordPost = () => {
        const k = universe[rand(universe.length)]!
        const op = rand(3)
        const v = value(k)
        postOps.push(c =>
            op === 0
                ? c.delete(rows(k))
                : op === 1
                  ? c.reset(rows(k))
                  : c.set(rows(k), v),
        )
    }
    let inTxn: string[] = []
    root.txn(tx => {
        const cx = { anc: tx.scope(X.anc), leaf: tx.scope(X.leaf) }
        const cr = { anc: tx.scope(R.anc), leaf: tx.scope(R.leaf) }
        if (rand(2)) historyOp(tx as any)
        if (rand(2)) cx.leaf.get(selected) // cached reads before the clears
        if (clearAnc && rand(2))
            cx.anc.set(rows(universe[rand(6)]!), value("staged")) // discarded
        const order = rand(2)
        if (clearAnc && order === 0) cx.anc.resetAll()
        if (leafCleared) cx.leaf.resetAll()
        if (clearAnc && order === 1) cx.anc.resetAll()
        if (rand(2)) historyOp(tx as any)
        for (let i = rand(3); i > 0; i--) {
            recordPost()
            const which = rand(2) ? "anc" : leafCleared ? "leaf" : "anc"
            const apply = postOps[postOps.length - 1]!
            apply(cx[which])
            apply(cr[which])
            if (rand(2)) cx.leaf.get(selected) // cached reads between writes
        }
        if (rand(2)) historyOp(tx as any)
        const compare = clearAnc
            ? (["anc", "mid", "leaf"] as const)
            : (["leaf"] as const)
        inTxn = compare.map(name => {
            const x =
                name === "mid"
                    ? tx.scope(X.mid)
                    : name === "anc"
                      ? cx.anc
                      : cx.leaf
            const r =
                name === "mid"
                    ? tx.scope(R.mid)
                    : name === "anc"
                      ? cr.anc
                      : cr.leaf
            const ox = coherent(x, rows, selected, [...universe, "staged"])
            const or = coherent(r, rows, selected, [...universe, "staged"])
            expect(ox).toBe(or)
            return ox
        })
    })
    const compare = clearAnc
        ? (["anc", "mid", "leaf"] as const)
        : (["leaf"] as const)
    compare.forEach((name, i) => {
        const ox = coherent(X[name], rows, selected, [...universe, "staged"])
        const or = coherent(R[name], rows, selected, [...universe, "staged"])
        expect(ox).toBe(or)
        expect(ox).toBe(inTxn[i]!)
    })
    return compare.length
}
