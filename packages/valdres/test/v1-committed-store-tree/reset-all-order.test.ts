// Transaction.resetAll() restores parent inheritance including collection
// membership order: the cleared scope reads as an untouched child would.
import { describe, expect, test } from "bun:test"
import {
    SubscriberNotificationError,
    atom,
    collection,
    family,
    store,
    type Store,
} from "../../src/index"
import { query } from "../../src/query"

const thrownBy = (operation: () => unknown): any => {
    try {
        operation()
    } catch (error) {
        return error
    }
    return undefined
}
const counter = () => {
    const c = { n: 0, fn: () => void c.n++ }
    return c
}
const keysOf = (rows: readonly any[]) => rows.map(r => r.key).join(",")
const keys = (s: Store | any, c: any): string => keysOf(s.get(c))

describe("resetAll order restoration", () => {
    test("required reproduction: a,c,d -> a,b,c,d; parent z -> a,b,c,d,z", () => {
        const rows = collection<string, number>()
        const root = store()
        for (const k of ["a", "b", "c", "d"]) root.set(rows(k), 1)
        const draft = root.scope("draft")
        draft.delete(rows("b"))
        expect(keys(draft, rows)).toBe("a,c,d")
        const seen = counter()
        draft.sub(rows, seen.fn)
        root.txn(tx => tx.scope(draft).resetAll())
        expect(keys(draft, rows)).toBe("a,b,c,d")
        expect(seen.n).toBe(1)
        root.set(rows("z"), 1)
        expect(keys(draft, rows)).toBe("a,b,c,d,z")
        expect(keys(root, rows)).toBe("a,b,c,d,z")
    })

    test("ordinary per-state reset semantics are unchanged (reveal appends)", () => {
        const rows = collection<string, number>()
        const root = store()
        for (const k of ["a", "b", "c", "d"]) root.set(rows(k), 1)
        const draft = root.scope("draft")
        draft.delete(rows("b"))
        draft.reset(rows("b"))
        expect(keys(draft, rows)).toBe("a,c,d,b")
        root.txn(tx => {
            tx.scope(draft).delete(rows("c"))
            tx.scope(draft).reset(rows("c"))
        })
        expect(keys(draft, rows)).toBe("a,d,b,c")
    })

    test("order-only divergence left by earlier single resets is restored and notifies", () => {
        const rows = collection<string, number>()
        const root = store()
        for (const k of ["a", "b", "c"]) root.set(rows(k), 1)
        const draft = root.scope("draft")
        draft.delete(rows("a"))
        draft.reset(rows("a")) // draft now owns nothing but reads b,c,a
        expect(keys(draft, rows)).toBe("b,c,a")
        const seen = counter()
        draft.sub(rows, seen.fn)
        const rowSeen = counter()
        draft.sub(rows("a"), rowSeen.fn)
        root.txn(tx => tx.scope(draft).resetAll())
        expect(keys(draft, rows)).toBe("a,b,c")
        expect(seen.n).toBe(1) // order-only change is observable
        expect(rowSeen.n).toBe(0) // row value unchanged
        // the divergence marker is consumed: a second clear is a no-op
        root.txn(tx => tx.scope(draft).resetAll())
        expect(seen.n).toBe(1)
    })

    test("untouched scope: no publication, membership array identity kept", () => {
        const rows = collection<string, number>()
        const x = atom(0)
        const root = store()
        root.set(rows("a"), 1)
        const draft = root.scope("draft")
        const array = draft.get(rows)
        const seen = counter()
        draft.sub(rows, seen.fn)
        draft.sub(x, seen.fn)
        root.txn(tx => tx.scope(draft).resetAll())
        expect(draft.get(rows)).toBe(array)
        expect(seen.n).toBe(0)
    })

    test("local additions, deletions and value changes across two collections", () => {
        const people = collection<string, string>()
        const tasks = collection<string, string>()
        const root = store()
        for (const k of ["p1", "p2", "p3"]) root.set(people(k), k)
        for (const k of ["t1", "t2"]) root.set(tasks(k), k)
        const draft = root.scope("draft")
        draft.delete(people("p1"))
        draft.set(people("p2"), "p2*")
        draft.set(people("new"), "new")
        draft.delete(tasks("t2"))
        draft.set(tasks("t0"), "t0")
        draft.delete(tasks("t1"))
        draft.set(tasks("t1"), "t1*") // re-inserted: moved to the end locally
        expect(keys(draft, people)).toBe("p2,p3,new")
        expect(keys(draft, tasks)).toBe("t0,t1")
        root.txn(tx => tx.scope(draft).resetAll())
        expect(keys(draft, people)).toBe("p1,p2,p3")
        expect(keys(draft, tasks)).toBe("t1,t2")
        expect(draft.get(people("p2"))).toBe("p2")
        expect(draft.get(tasks("t1"))).toBe("t1")
        expect(draft.get(people("new"))).toBeUndefined()
    })

    test("parent writes before and after the clear in the same transaction", () => {
        const rows = collection<string, number>()
        const root = store()
        for (const k of ["a", "b", "c"]) root.set(rows(k), 1)
        const draft = root.scope("draft")
        draft.delete(rows("a"))
        draft.set(rows("x"), 1)
        root.txn(tx => {
            tx.set(rows("p"), 1) // parent birth before clear
            tx.delete(rows("c")) // parent removal before clear
            tx.scope(draft).resetAll()
            tx.set(rows("q"), 1) // parent birth after clear
            expect(keysOf(tx.scope(draft).get(rows))).toBe("a,b,p,q")
        })
        expect(keys(root, rows)).toBe("a,b,p,q")
        expect(keys(draft, rows)).toBe("a,b,p,q")
    })

    test("reads before/after clear, writes staged after clear, repeated clear", () => {
        const rows = collection<string, number>()
        const root = store()
        for (const k of ["a", "b", "c"]) root.set(rows(k), 1)
        const draft = root.scope("draft")
        draft.delete(rows("b"))
        root.txn(tx => {
            const d = tx.scope(draft)
            expect(keysOf(d.get(rows))).toBe("a,c")
            d.set(rows("y"), 1) // staged before clear: discarded
            d.resetAll()
            expect(keysOf(d.get(rows))).toBe("a,b,c")
            d.set(rows("x"), 1) // local birth after clear
            tx.set(rows("p"), 1) // parent birth after that
            d.delete(rows("a")) // local deletion after clear
            expect(keysOf(d.get(rows))).toBe("b,c,x,p")
            d.resetAll() // second clear discards x and the deletion
            expect(keysOf(d.get(rows))).toBe("a,b,c,p")
            d.set(rows("z"), 1)
        })
        expect(keys(draft, rows)).toBe("a,b,c,p,z")
        // z is now owned again; the parent order keeps being followed
        root.set(rows("w"), 1)
        expect(keys(draft, rows)).toBe("a,b,c,p,z,w")
    })

    test("descendants: own overrides kept, non-owning descendants mirror the restored order", () => {
        const rows = collection<string, number>()
        const x = atom("root")
        const root = store()
        for (const k of ["a", "b", "c"]) root.set(rows(k), 1)
        const draft = root.scope("draft")
        const mirror = draft.scope("mirror") // owns nothing
        const owner = draft.scope("owner") // owns its own rows and an atom
        draft.delete(rows("a"))
        owner.set(rows("o"), 1)
        owner.set(x, "owner")
        expect(keys(mirror, rows)).toBe("b,c")
        expect(keys(owner, rows)).toBe("b,c,o")
        const mirrorSeen = counter()
        mirror.sub(rows, mirrorSeen.fn)
        const ownerSeen = counter()
        owner.sub(rows, ownerSeen.fn)
        root.txn(tx => {
            tx.scope(draft).resetAll()
            expect(keysOf(tx.scope(draft).scope("mirror").get(rows))).toBe(
                "a,b,c",
            )
        })
        expect(keys(draft, rows)).toBe("a,b,c")
        expect(keys(mirror, rows)).toBe("a,b,c")
        // a descendant with its own rows keeps its own order history: the
        // revealed row is a birth in its view (existing per-row rule)
        expect(keys(owner, rows)).toBe("b,c,o,a")
        expect(owner.get(x)).toBe("owner")
        expect(mirrorSeen.n).toBe(1)
        expect(ownerSeen.n).toBe(1)
    })

    test("nested scopes: clearing a child and its parent in one txn, or only the inner one", () => {
        const rows = collection<string, number>()
        const root = store()
        for (const k of ["a", "b", "c"]) root.set(rows(k), 1)
        const mid = root.scope("mid")
        const leaf = mid.scope("leaf")
        mid.delete(rows("a"))
        leaf.delete(rows("b"))
        expect(keys(leaf, rows)).toBe("c")
        root.txn(tx => tx.scope(leaf).resetAll())
        expect(keys(leaf, rows)).toBe("b,c") // mirrors mid, which still hides a
        leaf.delete(rows("c"))
        root.txn(tx => {
            tx.scope(leaf).resetAll()
            tx.scope(mid).resetAll()
        })
        expect(keys(mid, rows)).toBe("a,b,c")
        expect(keys(leaf, rows)).toBe("a,b,c")
    })

    test("indexed query results follow the restored order", () => {
        type E = { kind: "t" | "n" }
        const entities = collection<string, E, string, { kind: E["kind"] }>({
            indexes: { kind: e => e.kind },
        })
        const ts = query(entities, { where: { kind: { eq: "t" } } })
        const root = store()
        for (const k of ["a", "b", "c", "d"])
            root.set(entities(k), { kind: "t" as const })
        const draft = root.scope("draft")
        draft.delete(entities("b"))
        draft.set(entities("c"), { kind: "n" as const })
        expect(keysOf(draft.get(ts))).toBe("a,d")
        const seen = counter()
        draft.sub(ts, seen.fn)
        root.txn(tx => tx.scope(draft).resetAll())
        expect(keysOf(draft.get(ts))).toBe("a,b,c,d")
        expect(seen.n).toBe(1)
        root.set(entities("z"), { kind: "t" as const })
        expect(keysOf(draft.get(ts))).toBe("a,b,c,d,z")
        // order-only: diverge via single reset then bulk clear
        draft.delete(entities("a"))
        draft.reset(entities("a"))
        expect(keysOf(draft.get(ts))).toBe("b,c,d,z,a")
        root.txn(tx => tx.scope(draft).resetAll())
        expect(keysOf(draft.get(ts))).toBe("a,b,c,d,z")
    })

    test("rollback before apply restores order, values and history", () => {
        const rows = collection<string, number>()
        const root = store()
        for (const k of ["a", "b", "c"]) root.set(rows(k), 1)
        const draft = root.scope("draft")
        draft.delete(rows("b"))
        const array = draft.get(rows)
        const seen = counter()
        draft.sub(rows, seen.fn)
        const abort = new Error("abort")
        expect(
            thrownBy(() =>
                root.txn(tx => {
                    tx.scope(draft).resetAll()
                    throw abort
                }),
            ),
        ).toBe(abort)
        expect(draft.get(rows)).toBe(array)
        expect(seen.n).toBe(0)
        root.txn(tx => tx.scope(draft).resetAll())
        expect(keys(draft, rows)).toBe("a,b,c")
    })

    test("an error reported after apply does not undo the restore", () => {
        const rows = collection<string, number>()
        const root = store()
        for (const k of ["a", "b", "c"]) root.set(rows(k), 1)
        const draft = root.scope("draft")
        draft.delete(rows("b"))
        let throws = 1
        draft.sub(rows, () => {
            if (throws-- > 0) throw new Error("subscriber")
        })
        const error = thrownBy(() =>
            root.txn(tx => tx.scope(draft).resetAll()),
        )
        expect(error).toBeInstanceOf(SubscriberNotificationError)
        expect(keys(draft, rows)).toBe("a,b,c")
    })

    test("disposal and weak retention are unchanged", async () => {
        const root = store()
        const rows = collection<string, number>()
        const first = root.scope("draft")
        first.delete(rows("a"))
        first.dispose()
        const second = root.scope("draft")
        root.set(rows("a"), 1)
        root.txn(tx => tx.scope(second).resetAll())
        expect(keys(second, rows)).toBe("a")
        const refs = (() => {
            const out: WeakRef<object>[] = []
            const members = family((k: string) => atom(k))
            for (let i = 0; i < 16; i++) {
                const transient = atom(i)
                second.set(transient, -i)
                second.set(members(`m${i}`), "x")
                out.push(new WeakRef(transient), new WeakRef(members(`m${i}`)))
            }
            return out
        })()
        root.txn(tx => tx.scope(second).resetAll())
        let alive = refs.length
        for (let i = 0; i < 40 && alive; i++) {
            await Bun.sleep(1)
            Bun.gc(true)
            alive = refs.filter(r => r.deref() !== undefined).length
        }
        expect(alive).toBe(0)
    })

    test("seeded oracle: cleared scope equals an untouched reference scope", () => {
        oracleStats.divergedBefore = 0
        for (let seed = 1; seed <= 200; seed++) {
            const outcome = oracleProgram(seed)
            expect(outcome.draft).toEqual(outcome.reference)
            expect(outcome.identityKeptWhenUnchanged).toBe(true)
            expect(outcome.notifiedIffChanged).toBe(true)
        }
        // the oracle must exercise real order divergence, not only no-ops
        expect(oracleStats.divergedBefore).toBeGreaterThan(100)
        console.log(
            "oracle seeds with pre-clear order divergence:",
            oracleStats.divergedBefore,
        )
    })

    test("seeded: values/presence equal an explicit per-state reset loop", () => {
        for (let seed = 1; seed <= 150; seed++) {
            const bulk = valuesProgram(seed, "bulk")
            const loop = valuesProgram(seed, "loop")
            expect(bulk).toEqual(loop)
        }
    })
})

// ---------------------------------------------------------------------------
const rng = (seed: number) => {
    let state = seed >>> 0
    return (n: number) => {
        state = (Math.imul(state, 1103515245) + 12345) >>> 0
        return (state >>> 16) % n
    }
}

/** Untouched-reference oracle: `ref` (and `refGrand`) never had local state;
 * `draft` (and its non-owning `grand`) accumulate random history, then in one
 * txn: random parent writes, draft.resetAll(), random parent writes and the
 * same post-clear writes applied to both draft and ref. */
export const oracleStats = { divergedBefore: 0 }
const oracleProgram = (seed: number) => {
    const rand = rng(seed)
    type E = { kind: "t" | "n"; v: number }
    const rowsDef = collection<string, E, string, { kind: E["kind"] }>({
        indexes: { kind: e => e.kind },
    })
    const plain = collection<string, number>()
    const ts = query(rowsDef, { where: { kind: { eq: "t" } } })
    const atoms = [atom(0), atom(0)]
    const ks = ["a", "b", "c", "d", "e", "f"]
    const root = store()
    for (const k of ks.slice(0, 4)) {
        root.set(rowsDef(k), { kind: rand(2) ? "t" : "n", v: 0 } as E)
        root.set(plain(k), 0)
    }
    const draft = root.scope("draft")
    const grand = draft.scope("grand")
    const ref = root.scope("ref")
    const refGrand = ref.scope("grand")
    const value = (): E => ({ kind: rand(2) ? "t" : "n", v: rand(3) })
    const op = (target: any) => {
        const which = rand(3)
        if (which === 0) {
            const x = atoms[rand(atoms.length)]!
            rand(3) ? target.set(x, rand(4)) : target.reset(x)
            return
        }
        const k = ks[rand(ks.length)]!
        const row = which === 1 ? rowsDef(k) : plain(k)
        const kind = rand(4)
        if (kind === 0) target.delete(row)
        else if (kind === 1) target.reset(row)
        else target.set(row, which === 1 ? value() : rand(3))
    }
    // history: root and draft writes, including single resets that diverge order
    for (let i = 0; i < 25; i++) op(rand(3) === 0 ? root : draft)
    const observed = [draft, grand].flatMap(s => [
        s.get(rowsDef),
        s.get(plain),
        s.get(ts),
    ])
    const counts = new Map<string, number>()
    const states = [rowsDef, plain, ts] as const
    for (const [si, s] of [draft, grand].entries())
        for (const [i, st] of states.entries()) {
            s.sub(st as any, () =>
                counts.set(`${si}:${i}`, (counts.get(`${si}:${i}`) ?? 0) + 1),
            )
        }
    for (const s of [ref, refGrand]) for (const st of states) s.get(st as any)
    const beforeRef = states.map(st => ref.get(st as any) as readonly any[])
    const post: Array<(c: any) => void> = []
    const recordingOp = () => {
        const r = rand(1 << 30)
        post.push(target => {
            const local = rng(r)
            const which = local(3)
            if (which === 0) {
                const x = atoms[local(atoms.length)]!
                local(3) ? target.set(x, local(4)) : target.reset(x)
                return
            }
            const k = ks[local(ks.length)]!
            const row = which === 1 ? rowsDef(k) : plain(k)
            const kind = local(4)
            if (kind === 0) target.delete(row)
            else if (kind === 1) target.reset(row)
            else
                target.set(
                    row,
                    which === 1
                        ? { kind: local(2) ? "t" : "n", v: local(3) }
                        : local(3),
                )
        })
    }
    let inTxn: { draft: string[]; reference: string[] } | undefined
    root.txn(tx => {
        for (let i = rand(5); i > 0; i--) op(rand(2) ? tx : tx.scope(draft)) // includes staged draft writes
        tx.scope(draft).resetAll()
        for (let i = rand(4); i > 0; i--) {
            if (rand(2)) op(tx)
            else {
                recordingOp()
                const apply = post[post.length - 1]!
                apply(tx.scope(draft))
                apply(tx.scope(ref))
            }
        }
        const snap = (s: any) =>
            [rowsDef, plain, ts].map(st => keysOf(s.get(st)))
        inTxn = {
            draft: [
                ...snap(tx.scope(draft)),
                ...snap(tx.scope(draft).scope("grand")),
            ],
            reference: [
                ...snap(tx.scope(ref)),
                ...snap(tx.scope(ref).scope("grand")),
            ],
        }
    })
    const view = (s: Store) => ({
        atoms: atoms.map(x => s.get(x)),
        rows: ks.map(k => [s.get(rowsDef(k)), s.get(plain(k))]),
        order: [keys(s, rowsDef), keys(s, plain), keysOf(s.get(ts))],
    })
    const after = [draft, grand].flatMap(s => [
        s.get(rowsDef),
        s.get(plain),
        s.get(ts),
    ])
    let identityKeptWhenUnchanged = true
    let notifiedIffChanged = true
    after.forEach((array, i) => {
        const unchanged = keysOf(array) === keysOf(observed[i]!)
        if (unchanged && array !== observed[i])
            identityKeptWhenUnchanged = false
        const notified = (counts.get(`${Math.floor(i / 3)}:${i % 3}`) ?? 0) > 0
        if (notified !== !unchanged) notifiedIffChanged = false
    })
    oracleStats.divergedBefore += observed
        .slice(0, 3)
        .some((array, i) => keysOf(array) !== keysOf(beforeRef[i]!))
        ? 1
        : 0
    const draftFinal = [view(draft), view(grand)]
    const referenceFinal = [view(ref), view(refGrand)]
    // future behaviour: later parent-only writes keep both views identical
    for (let i = 0; i < 4; i++) op(root)
    return {
        draft: {
            final: draftFinal,
            inTxn: inTxn!.draft,
            later: [view(draft), view(grand)],
        },
        reference: {
            final: referenceFinal,
            inTxn: inTxn!.reference,
            later: [view(ref), view(refGrand)],
        },
        identityKeptWhenUnchanged,
        notifiedIffChanged,
    }
}

const valuesProgram = (seed: number, mode: "bulk" | "loop") => {
    const rand = rng(seed)
    const rowsDef = collection<string, number>()
    const atoms = [atom(0), atom(0), atom(0)]
    const ks = ["a", "b", "c", "d"]
    const root = store()
    for (const k of ks) root.set(rowsDef(k), 0)
    const draft = root.scope("draft")
    const owned = new Set<any>()
    for (let i = 0; i < 20; i++) {
        const onDraft = rand(2) === 0
        const target: any = onDraft ? draft : root
        const pick = rand(2)
        const state = pick ? atoms[rand(3)]! : rowsDef(ks[rand(4)]!)
        const kind = rand(3)
        if (kind === 0) target.reset(state)
        else if (kind === 1 && !pick) target.delete(state)
        else target.set(state, rand(4))
        if (onDraft) owned.add(state)
    }
    root.txn(tx => {
        tx.set(atoms[0]!, 9)
        if (mode === "bulk") tx.scope(draft).resetAll()
        else for (const s of owned) tx.scope(draft).reset(s)
        tx.set(rowsDef("a"), 7)
    })
    return {
        atoms: atoms.map(x => draft.get(x)),
        rows: ks.map(k => draft.get(rowsDef(k))),
        members: new Set(draft.get(rowsDef).map(r => r.key)),
    }
}
