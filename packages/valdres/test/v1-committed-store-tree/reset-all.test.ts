// Transaction.resetAll() (experimental): owned-state coverage, staging,
// failure and rollback, isolation, callback phases and retention.
import { describe, expect, test } from "bun:test"
import {
    CallbackCapabilityError,
    SelectorCapabilityError,
    StoreDisposedError,
    SubscriberNotificationError,
    TransactionClosedError,
    TransactionPhaseError,
    atom,
    collection,
    externalAtom,
    family,
    selector,
    store,
    type Store,
} from "../../src/index"
import { query } from "../../src/query"
import {
    createDomainStore,
    createInternalStoreTreeInstrumentation,
} from "../../src/v1-internal/committed-store-tree/committed-store-tree"
import { v1Domain } from "../../src/v1-internal/public-domain"

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
const keys = (s: Store, c: any): unknown[] =>
    (s.get(c) as any[]).map((r: any) => r.key)
const instrumented = () => {
    const counters = createInternalStoreTreeInstrumentation()
    return {
        root: createDomainStore(v1Domain, counters) as Store,
        read: (name: string) => counters.read(name as never),
    }
}
const collected = async (references: WeakRef<object>[]): Promise<number> => {
    let retained = references.length
    for (let round = 0; round < 40 && retained !== 0; round++) {
        await Bun.sleep(1)
        Bun.gc(true)
        retained = references.filter(r => r.deref() !== undefined).length
    }
    return references.length - retained
}

describe("Transaction.resetAll", () => {
    describe("coverage of owned state kinds", () => {
        test("ordinary atoms and family members are cleared; unowned untouched", () => {
            const root = store()
            const a = atom("root-a")
            const b = atom("root-b")
            const untouched = atom("root-u")
            const lookup = family((id: string) => atom(`fallback-${id}`))
            const draft = root.scope("draft")
            draft.set(a, "draft-a")
            draft.set(b, "draft-b")
            draft.set(lookup("x"), "draft-x")
            draft.set(lookup("y"), "draft-y")
            const seen = counter()
            draft.sub(untouched, seen.fn)
            root.txn(tx => tx.scope(draft).resetAll())
            expect(draft.get(a)).toBe("root-a")
            expect(draft.get(b)).toBe("root-b")
            expect(draft.get(lookup("x"))).toBe("fallback-x")
            expect(draft.get(lookup("y"))).toBe("fallback-y")
            expect(seen.n).toBe(0)
            root.set(a, "later")
            expect(draft.get(a)).toBe("later")
        })

        test("present rows and local deletion markers are cleared; index query follows", () => {
            type E = { kind: "task" | "note"; title: string }
            const entities = collection<string, E, string, { kind: E["kind"] }>(
                {
                    indexes: { kind: e => e.kind },
                },
            )
            const v = (kind: E["kind"], title: string): E => ({ kind, title })
            const tasks = query(entities, { where: { kind: { eq: "task" } } })
            const root = store()
            const [a, b, c] = ["a", "b", "c"].map(k => entities(k)) as [
                ReturnType<typeof entities>,
                ReturnType<typeof entities>,
                ReturnType<typeof entities>,
            ]
            root.set(a, v("task", "A"))
            root.set(b, v("note", "B"))
            const draft = root.scope("draft")
            draft.delete(a) // marker over a parent row
            draft.set(b, v("task", "B'")) // local value
            draft.set(c, v("task", "C")) // draft-only row
            draft.delete(entities("ghost")) // marker over an absent row
            expect(keys(draft, entities)).toEqual(["b", "c"])
            expect(draft.get(tasks).map(r => r.key)).toEqual(["b", "c"])
            root.txn(tx => tx.scope(draft).resetAll())
            expect(draft.get(a)).toEqual(v("task", "A"))
            expect(draft.get(c)).toBeUndefined()
            expect(draft.get(b)).toEqual(v("note", "B"))
            expect(draft.get(tasks).map(r => r.key)).toEqual(["a"])
            root.set(entities("ghost"), v("task", "G"))
            expect(draft.get(entities("ghost"))).toEqual(v("task", "G"))
        })

        test("external sources and selectors are never touched or sampled", () => {
            let samples = 0
            const source = externalAtom({
                getSnapshot: () => (samples++, 1),
                subscribe: () => () => undefined,
            })
            const root = store()
            const draft = root.scope("draft")
            const x = atom(0)
            const derived = selector(get => get(x) + 1)
            draft.set(x, 5)
            expect(draft.get(derived)).toBe(6)
            const attached = counter()
            draft.sub(source, attached.fn)
            const mixed = selector(get => get(source) + get(x))
            draft.sub(mixed, attached.fn)
            expect(draft.get(mixed)).toBe(6)
            const before = samples
            root.txn(tx => tx.scope(draft).resetAll())
            expect(samples).toBe(before)
            expect(draft.get(derived)).toBe(1)
            expect(draft.get(source)).toBe(1)
            expect(draft.get(mixed)).toBe(1)
            expect(attached.n).toBe(1) // only `mixed` changed
        })
    })

    describe("transaction staging semantics", () => {
        test("writes staged earlier in the txn are cleared; later writes re-own; reads are symbolic", () => {
            const root = store()
            const a = atom("root")
            const b = atom("root-b")
            const rows = collection<string, number>()
            const r = rows("r")
            const draft = root.scope("draft")
            root.txn(tx => {
                const d = tx.scope(draft)
                d.set(a, "staged")
                d.set(r, 1)
                d.delete(rows("never-committed"))
                d.resetAll()
                expect(d.get(a)).toBe("root")
                expect(d.get(r)).toBeUndefined()
                tx.set(a, "parent-after-clear")
                expect(d.get(a)).toBe("parent-after-clear") // symbolic: follows later parent intent
                d.set(b, "re-owned")
            })
            expect(draft.get(a)).toBe("parent-after-clear")
            expect(draft.get(r)).toBeUndefined()
            expect(draft.get(b)).toBe("re-owned")
            root.set(b, "root-later")
            expect(draft.get(b)).toBe("re-owned")
        })

        test("same-transaction parent writes before and after the clear", () => {
            const root = store()
            const a = atom(0)
            const b = atom(0)
            const draft = root.scope("draft")
            draft.set(a, 10)
            draft.set(b, 10)
            const observed: number[][] = []
            const both = selector(get => [get(a), get(b)])
            draft.sub(both, () => observed.push(draft.get(both)))
            root.txn(tx => {
                tx.set(a, 1)
                tx.scope(draft).resetAll()
                tx.set(b, 2)
            })
            expect(observed).toEqual([[1, 2]])
        })

        test("repeated clear and empty scope publish nothing", () => {
            const { root, read } = instrumented()
            const a = atom(0)
            const draft = root.scope("draft")
            const seen = counter()
            draft.sub(a, seen.fn)
            root.sub(a, seen.fn)
            const settlements = read("propagationSettlements")
            root.txn(tx => {
                tx.scope(draft).resetAll()
                tx.scope(draft).resetAll()
            })
            draft.set(a, 1)
            seen.n = 0
            root.txn(tx => {
                tx.scope(draft).resetAll()
                tx.scope(draft).resetAll()
            })
            expect(seen.n).toBe(1)
            expect(draft.get(a)).toBe(0)
            const afterReal = read("propagationSettlements")
            root.txn(tx => tx.scope(draft).resetAll())
            expect(read("propagationSettlements")).toBe(afterReal)
            expect(afterReal).toBeGreaterThan(settlements)
        })

        test("values match an explicit reset loop (seeded differential)", () => {
            // Only values: the bulk clear restores parent order where a reset
            // loop appends revealed rows. Order is covered by
            // reset-all-order and reset-all-model-differential.
            for (const profile of ["mixed", "reveal"] as const) {
                for (let seed = 1; seed <= 150; seed++) {
                    const a = runProgram(seed, "bulk", profile)
                    const b = runProgram(seed, "explicit", profile)
                    expect(a.values).toEqual(b.values)
                }
            }
        })
    })

    describe("failure and rollback", () => {
        test("throw after clear rolls back everything with no notifications", () => {
            const root = store()
            const a = atom("root")
            const rows = collection<string, number>()
            const draft = root.scope("draft")
            draft.set(a, "local")
            draft.delete(rows("r"))
            root.set(rows("r"), 1)
            const seen = counter()
            draft.sub(a, seen.fn)
            draft.sub(rows, seen.fn)
            const abort = new Error("abort")
            expect(
                thrownBy(() =>
                    root.txn(tx => {
                        tx.set(a, "updated")
                        tx.scope(draft).resetAll()
                        throw abort
                    }),
                ),
            ).toBe(abort)
            expect(draft.get(a)).toBe("local")
            expect(keys(draft, rows)).toEqual([])
            expect(seen.n).toBe(0)
        })

        test("a reset-resolution failure (lazy parent fallback) stages nothing; caught, the txn continues", () => {
            const root = store()
            const boom = new Error("lazy init failed")
            const lazy = atom.lazy<number>(() => {
                throw boom
            })
            const fine = atom("root")
            const draft = root.scope("draft")
            draft.set(fine, "local-fine")
            draft.set(lazy, 1)
            root.txn(tx => {
                const d = tx.scope(draft)
                expect(thrownBy(() => d.resetAll())).toBe(boom)
                // atomic: the ordinary atom was NOT reset either
                expect(d.get(fine)).toBe("local-fine")
                d.set(fine, "kept")
            })
            expect(draft.get(fine)).toBe("kept")
            expect(draft.get(lazy)).toBe(1)
        })

        test("failure after apply (subscriber throw) is not rollback: the clear committed", () => {
            const root = store()
            const a = atom("root")
            const draft = root.scope("draft")
            draft.set(a, "local")
            const boom = new Error("subscriber")
            let throws = 1
            draft.sub(a, () => {
                if (throws-- > 0) throw boom
            })
            const error = thrownBy(() =>
                root.txn(tx => {
                    tx.set(a, "updated")
                    tx.scope(draft).resetAll()
                }),
            )
            expect(error).toBeInstanceOf(SubscriberNotificationError)
            expect(error.committed).toBe(true)
            expect(draft.get(a)).toBe("updated")
            root.set(a, "followed")
            expect(draft.get(a)).toBe("followed")
        })
    })

    describe("scope isolation, identity and notification", () => {
        test("grandchild own overrides and siblings are preserved; inheriting grandchild follows once", () => {
            const root = store()
            const a = atom("root-a")
            const b = atom("root-b")
            const rows = collection<string, number>()
            const draft = root.scope("draft")
            const panel = draft.scope("panel")
            const sibling = root.scope("sibling")
            draft.set(a, "draft-a")
            draft.set(b, "draft-b")
            panel.set(b, "panel-b")
            panel.set(rows("p"), 1)
            sibling.set(a, "sibling-a")
            const panelA = counter()
            panel.sub(a, panelA.fn)
            const panelB = counter()
            panel.sub(b, panelB.fn)
            root.txn(tx => {
                tx.set(a, "applied")
                tx.scope(draft).resetAll()
            })
            expect(panel.get(a)).toBe("applied")
            expect(panel.get(b)).toBe("panel-b")
            expect(panel.get(rows("p"))).toBe(1)
            expect(sibling.get(a)).toBe("sibling-a")
            expect(panelA.n).toBe(1)
            expect(panelB.n).toBe(0)
            expect(root.scope("draft")).toBe(draft)
            expect(draft.scope("panel")).toBe(panel)
        })

        test("subscribers observe one coherent final state across atoms, rows and membership", () => {
            const root = store()
            const title = atom("t0")
            const todos = collection<string, { t: string }>()
            const draft = root.scope("draft")
            draft.set(title, "draft-title")
            draft.set(todos("n"), { t: "new" })
            const snapshots: unknown[] = []
            const view = selector(get => ({
                title: get(title),
                rows: get(todos).map(r => get(r)?.t),
            }))
            const record = () => snapshots.push(draft.get(view))
            draft.sub(view, record)
            draft.sub(title, record)
            draft.sub(todos, record)
            root.txn(tx => {
                tx.set(title, "draft-title")
                tx.set(todos("n"), tx.scope(draft).get(todos("n"))!)
                tx.scope(draft).resetAll()
            })
            // same references applied → nothing changed observably
            expect(snapshots).toEqual([])
            root.txn(tx => {
                tx.set(title, "t1")
                tx.delete(todos("n"))
            })
            expect(new Set(snapshots.map(s => JSON.stringify(s)))).toEqual(
                new Set([JSON.stringify({ title: "t1", rows: [] })]),
            )
        })

        test("custom equality: reset is not comparator-pruned; same reference is silent", () => {
            const root = store()
            const v = atom({ id: 1 }, { equal: (p, n) => p.id === n.id })
            const draft = root.scope("draft")
            draft.set(v, { id: 2 })
            const seen = counter()
            draft.sub(v, seen.fn)
            root.txn(tx => {
                tx.set(v, { id: 2 })
                tx.scope(draft).resetAll()
            })
            expect(seen.n).toBe(1)
            const shared = { id: 3 }
            draft.set(v, shared)
            seen.n = 0
            root.txn(tx => {
                tx.set(v, shared)
                tx.scope(draft).resetAll()
            })
            expect(seen.n).toBe(0)
        })

        test("collection order: revealed rows append in ownership-acquisition order; survivors keep position", () => {
            const rows = collection<string, number>()
            const root = store()
            for (const k of ["a", "b", "c", "d"]) root.set(rows(k), 1)
            const draft = root.scope("draft")
            draft.delete(rows("c")) // acquired 1st
            draft.set(rows("n"), 1) // acquired 2nd (draft-only, survives if applied)
            draft.delete(rows("a")) // acquired 3rd
            expect(keys(draft, rows)).toEqual(["b", "d", "n"])
            root.txn(tx => {
                tx.set(rows("n"), 1)
                tx.scope(draft).resetAll()
            })
            expect(keys(root, rows)).toEqual(["a", "b", "c", "d", "n"])
            // order is the parent's, not the acquisition order
            expect(keys(draft, rows)).toEqual(["a", "b", "c", "d", "n"])
        })
    })

    describe("callback phases, errors and lifecycle", () => {
        test("root cursor and arguments reject before staging; earlier intents survive if caught", () => {
            const root = store()
            const a = atom(0)
            const draft = root.scope("draft")
            draft.set(a, 1)
            root.txn(tx => {
                tx.set(a, 5)
                expect(thrownBy(() => tx.resetAll())).toBeInstanceOf(
                    TypeError,
                )
                expect(
                    thrownBy(() => (tx.scope(draft).resetAll as any)(a)),
                ).toBeInstanceOf(TypeError)
                expect(tx.scope(draft).get(a)).toBe(1)
            })
            expect(root.get(a)).toBe(5)
            expect(draft.get(a)).toBe(1)
            // a child Store's own txn cursor is a child cursor
            draft.txn(tx => tx.resetAll())
            expect(draft.get(a)).toBe(5)
        })

        test("closed, captured and disposed cursors follow existing guards", () => {
            const root = store()
            const a = atom(0)
            const draft = root.scope("draft")
            let retained!: any
            root.txn(tx => {
                retained = tx.scope(draft)
            })
            expect(thrownBy(() => retained.resetAll())).toBeInstanceOf(
                TransactionClosedError,
            )
            let captured!: any
            let inSub: unknown
            let inSelector: unknown
            const probe = selector(get => {
                inSelector ??= thrownBy(() => captured?.resetAll())
                return get(a)
            })
            root.sub(a, () => {
                inSub = thrownBy(() => captured.resetAll())
            })
            root.txn(tx => {
                captured = tx.scope(draft)
                tx.get(probe)
                tx.set(a, 1)
            })
            expect(inSelector).toBeInstanceOf(SelectorCapabilityError)
            expect(inSub).toBeInstanceOf(TransactionClosedError)
            const doomed = root.scope("doomed")
            doomed.dispose()
            root.txn(tx =>
                expect(thrownBy(() => tx.scope(doomed))).toBeInstanceOf(
                    StoreDisposedError,
                ),
            )
            void TransactionPhaseError
            void CallbackCapabilityError
        })

        test("usable from settle: a draft settle handler clears its own scope in the same boundary", () => {
            const root = store()
            const applied = atom(0)
            const a = atom("root")
            const draft = root.scope("draft")
            draft.set(a, "local")
            const observed: Array<[number, string]> = []
            draft.sub(applied, {
                settle: tx => tx.resetAll(),
                notify: () => observed.push([draft.get(applied), draft.get(a)]),
            })
            root.txn(tx => {
                tx.set(a, "updated")
                tx.set(applied, 1)
            })
            expect(observed).toEqual([[1, "updated"]])
            expect(draft.get(a)).toBe("updated")
        })

        test("settle handlers may re-own after the clear (no convergence guarantee)", () => {
            const root = store()
            const a = atom("root")
            const echo = atom("none")
            const draft = root.scope("draft")
            draft.set(a, "local")
            draft.sub(a, { settle: tx => tx.set(echo, `saw:${tx.get(a)}`) })
            root.txn(tx => {
                tx.set(a, "updated")
                tx.scope(draft).resetAll()
            })
            expect(draft.get(echo)).toBe("saw:updated")
        })

        test("dispose drops the index; a recreated scope owns nothing", () => {
            const { root, read } = instrumented()
            const a = atom(0)
            const first = root.scope("draft")
            first.set(a, 1)
            expect(read("ownedAtomRetains")).toBe(1)
            first.dispose()
            const second = root.scope("draft")
            const seen = counter()
            second.sub(a, seen.fn)
            root.txn(tx => tx.scope(second).resetAll())
            expect(seen.n).toBe(0)
            expect(second.get(a)).toBe(0)
        })
    })

    describe("retention and index accounting", () => {
        test("root writes never touch the index; child acquisition indexes once; release is lazy", () => {
            const { root, read } = instrumented()
            const a = atom(0)
            for (let i = 0; i < 100; i++) root.set(a, i)
            expect(read("ownedAtomRetains")).toBe(0)
            const draft = root.scope("draft")
            for (let i = 0; i < 100; i++) draft.set(a, i)
            expect(read("ownedAtomRetains")).toBe(1)
            // own/release cycles of the same Atom never re-index
            for (let i = 0; i < 100; i++) {
                draft.reset(a)
                draft.set(a, i)
            }
            expect(read("ownedAtomRetains")).toBe(1)
            draft.reset(a)
            const members = family((k: string) => atom(k))
            draft.set(members("m"), "x") // family member: retained set, not index
            expect(read("ownedAtomRetains")).toBe(1)
            expect(read("familyOwnerRetains")).toBe(1)
            // the stale (released) entry is skipped by resetAll
            const seen = counter()
            draft.sub(a, seen.fn)
            root.txn(tx => tx.scope(draft).resetAll())
            expect(seen.n).toBe(0)
            expect(read("familyOwnerReleases")).toBe(1)
        })

        test("released-but-live entries are swept once the index doubles", () => {
            const { root, read } = instrumented()
            const draft = root.scope("draft")
            const xs = Array.from({ length: 200 }, () => atom(0))
            for (const x of xs) draft.set(x, 1)
            for (const x of xs) draft.reset(x)
            const before = read("ownedAtomSweptReferences")
            // new acquisitions push the index past its sweep threshold
            const ys = Array.from({ length: 300 }, () => atom(0))
            for (const y of ys) draft.set(y, 1)
            expect(read("ownedAtomSweptReferences") - before).toBe(200)
            void xs
        })

        test("an overridden ordinary Atom dropped by the app stays collectable (index is weak)", async () => {
            const root = store()
            const draft = root.scope("draft")
            const references = (() => {
                const out: WeakRef<object>[] = []
                for (let i = 0; i < 64; i++) {
                    const transient = atom({ i })
                    draft.set(transient, { i: -i })
                    out.push(new WeakRef(transient))
                }
                return out
            })()
            expect(await collected(references)).toBe(references.length)
            root.txn(tx => tx.scope(draft).resetAll()) // tolerates dead refs
        })

        test("dead index references are swept amortized under churn without reset", async () => {
            const { root, read } = instrumented()
            const draft = root.scope("draft")
            const keep = atom(0)
            draft.set(keep, 1)
            const churn = (n: number) => {
                for (let i = 0; i < n; i++) draft.set(atom(i), i)
            }
            for (let round = 0; round < 20; round++) {
                churn(500)
                await Bun.sleep(0)
                Bun.gc(true)
            }
            churn(500) // triggers sweeps over collected references
            const retains = read("ownedAtomRetains")
            const swept = read("ownedAtomSweptReferences")
            expect(retains).toBe(10_501)
            // nearly everything that was dropped has been swept, so the live
            // reference set stays O(live owned + sweep threshold)
            expect(retains - swept).toBeLessThan(2_000)
            root.txn(tx => tx.scope(draft).resetAll())
            expect(draft.get(keep)).toBe(0)
        })

        test("family members and rows are released by the clear and become collectable", async () => {
            const root = store()
            const draft = root.scope("draft")
            const references = (() => {
                const members = family((k: string) => atom(k))
                const rows = collection<string, number>()
                const out: WeakRef<object>[] = []
                for (let i = 0; i < 16; i++) {
                    draft.set(members(`m${i}`), "owned")
                    draft.set(rows(`r${i}`), i)
                    out.push(new WeakRef(members(`m${i}`)))
                    out.push(new WeakRef(rows(`r${i}`)))
                }
                return out
            })()
            // owned family members and rows are pinned by existing strong sets
            await Bun.sleep(0)
            Bun.gc(true)
            expect(references.every(r => r.deref() !== undefined)).toBe(true)
            root.txn(tx => tx.scope(draft).resetAll())
            expect(await collected(references)).toBe(references.length)
        })
    })
})

// ---------------------------------------------------------------------------
// Seeded differential: bulk resetAll vs an explicit reset loop in the
// documented order (committed acquisition order, then first-staged order).
type Mode = "bulk" | "explicit"
const runProgram = (
    seed: number,
    mode: Mode,
    profile: "mixed" | "reveal" = "mixed",
) => {
    let state = seed >>> 0
    const rand = (n: number) => {
        state = (Math.imul(state, 1103515245) + 12345) >>> 0
        return (state >>> 16) % n
    }
    const root = store()
    const draft = root.scope("draft")
    const grand = draft.scope("grand")
    const scopes = [root, draft, grand]
    const atoms = Array.from({ length: 4 }, (_, i) => atom(i * 100))
    const rowsDef = collection<string, number>()
    const rowKeys = ["a", "b", "c", "d", "e"]
    const rows = rowKeys.map(k => rowsDef(k))
    // mirror of the draft's committed ownership in acquisition order
    const ownedAtoms: object[] = []
    const ownedRows: object[] = []
    const own = (list: object[], s: object) => {
        if (!list.includes(s)) list.push(s)
    }
    const release = (list: object[], s: object) => {
        const i = list.indexOf(s)
        if (i >= 0) list.splice(i, 1)
    }
    const counts = new Map<string, number>()
    for (const [si, s] of scopes.entries()) {
        for (const [i, x] of atoms.entries())
            s.sub(x, () =>
                counts.set(`${si}a${i}`, (counts.get(`${si}a${i}`) ?? 0) + 1),
            )
        for (const [i, r] of rows.entries())
            s.sub(r, () =>
                counts.set(`${si}r${i}`, (counts.get(`${si}r${i}`) ?? 0) + 1),
            )
        s.sub(rowsDef, () =>
            counts.set(`${si}m`, (counts.get(`${si}m`) ?? 0) + 1),
        )
    }
    const randomOp = (
        onDraft: (kind: string, s: object) => void,
        cursor: any,
        si: number,
    ) => {
        const isRow = rand(2) === 0
        if (!isRow) {
            const x = atoms[rand(atoms.length)]!
            if (rand(4) === 0) {
                cursor.reset(x)
                if (si === 1) onDraft("release", x)
            } else {
                cursor.set(x, rand(5))
                if (si === 1) onDraft("own", x)
            }
            return
        }
        const r = rows[rand(rows.length)]!
        const op = rand(4)
        if (op === 0) {
            cursor.reset(r)
            if (si === 1) onDraft("release", r)
        } else if (op === 1) {
            cursor.delete(r)
            if (si === 1) onDraft("own", r)
        } else {
            cursor.set(r, rand(5))
            if (si === 1) onDraft("own", r)
        }
    }
    if (profile === "reveal") {
        // root holds every row; the draft mostly hides rows in random order
        for (const r of rows) root.set(r, 1)
        for (let step = 0; step < 8; step++) {
            const r = rows[rand(rows.length)]!
            if (rand(4) === 0) {
                draft.reset(r)
                release(ownedRows, r)
            } else {
                draft.delete(r)
                own(ownedRows, r)
            }
        }
    }
    for (let step = 0; step < (profile === "reveal" ? 0 : 30); step++) {
        const si = rand(3)
        randomOp(
            (kind, s) => {
                const list = atoms.includes(s as never) ? ownedAtoms : ownedRows
                kind === "own" ? own(list, s) : release(list, s)
            },
            scopes[si],
            si,
        )
    }
    counts.clear()
    root.txn(tx => {
        const cursors = [tx, tx.scope(draft), tx.scope(draft).scope("grand")]
        const stagedAtoms: object[] = []
        const stagedRows: object[] = []
        for (let i = 0; i < 4; i++) {
            const si = rand(3)
            randomOp(
                (_kind, s) => {
                    const list = atoms.includes(s as never)
                        ? stagedAtoms
                        : stagedRows
                    if (!list.includes(s)) list.push(s)
                },
                cursors[si],
                si,
            )
        }
        if (mode === "bulk") {
            cursors[1].resetAll()
        } else {
            const order = (committed: object[], staged: object[]) => [
                ...committed,
                ...staged.filter(s => !committed.includes(s)),
            ]
            for (const s of order(ownedAtoms, stagedAtoms))
                cursors[1].reset(s as never)
            for (const s of order(ownedRows, stagedRows))
                cursors[1].reset(s as never)
        }
        for (let i = 0; i < 3; i++) {
            const si = rand(3)
            randomOp(() => undefined, cursors[si], si)
        }
    })
    return {
        values: scopes.map(s => [
            ...atoms.map(x => s.get(x)),
            ...rows.map(r => s.get(r)),
        ]),
        order: scopes.map(s => keys(s, rowsDef)),
        notifications: [...counts.entries()].sort(),
    }
}
