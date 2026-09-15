import { describe, expect, test } from "../performance/test-compat"
import {
    atom,
    collection,
    selector,
    store,
    type CollectionRow,
} from "../../src/index"
import { query } from "../../src/query"

type EntityRef = `entity:${number}`
type Entity = { kind: "task" | "person"; title: string }
const define = (extract = (entity: Entity) => entity.kind) =>
    collection<EntityRef, Entity, EntityRef, { kind: Entity["kind"] }>({
        indexes: { kind: extract },
    })
const entity = (kind: Entity["kind"] = "task", title = "title"): Entity => ({
    kind,
    title,
})
const keys = (rows: readonly CollectionRow<EntityRef, Entity>[]) =>
    rows.map(row => row.key)

describe("native scalar equality indexes", () => {
    test("initial materialization, value updates, key changes, delete and transaction-final order", () => {
        let calls = 0
        const entities = define(value => {
            calls++
            return value.kind
        })
        const s = store()
        const a = entities("entity:1"),
            b = entities("entity:2"),
            c = entities("entity:3")
        s.txn(tx => {
            tx.set(a, entity())
            tx.set(b, entity("person"))
            tx.set(c, entity())
        })
        expect(calls).toBe(0)
        const tasks = query(entities, { where: { kind: { eq: "task" } } })
        expect(keys(s.get(tasks))).toEqual([a.key, c.key])
        expect(calls).toBe(3)
        const initial = s.get(tasks)
        let notifications = 0
        s.sub(tasks, () => notifications++)
        s.set(a, entity("task", "changed"))
        expect(s.get(tasks)).toBe(initial)
        expect(notifications).toBe(0)
        s.set(b, entity())
        expect(keys(s.get(tasks))).toEqual([a.key, b.key, c.key])
        s.txn(tx => {
            tx.delete(a)
            tx.set(a, entity())
            tx.set(a, entity("task", "last"))
        })
        expect(keys(s.get(tasks))).toEqual([b.key, c.key, a.key])
        expect(keys(s.get(entities))).toEqual([b.key, c.key, a.key])
        s.delete(c)
        expect(keys(s.get(tasks))).toEqual([b.key, a.key])
        const before = s.get(tasks)
        s.txn(tx => {
            tx.delete(a)
            tx.set(a, entity())
        })
        expect(s.get(tasks)).toBe(before)
        s.dispose()
    })

    test("inheritance, equal shadows, tombstones, reset and disposal", () => {
        const entities = define()
        const s = store(),
            child = s.scope("child"),
            sibling = s.scope("sibling")
        const tasks = query(entities, { where: { kind: { eq: "task" } } })
        const a = entities("entity:1"),
            b = entities("entity:2")
        const value = entity()
        s.set(a, value)
        expect(keys(child.get(tasks))).toEqual([a.key])
        expect(keys(sibling.get(tasks))).toEqual([a.key])
        child.set(a, value)
        s.delete(a)
        expect(keys(child.get(tasks))).toEqual([a.key])
        expect(sibling.get(tasks)).toEqual([])
        s.set(b, value)
        expect(keys(child.get(tasks))).toEqual([a.key, b.key])
        child.delete(b)
        s.set(b, entity("person"))
        child.reset(b)
        expect(keys(child.get(tasks))).toEqual([a.key])
        child.reset(a)
        expect(child.get(tasks)).toEqual([])
        child.dispose()
        s.set(a, value)
        expect(keys(sibling.get(tasks))).toEqual([a.key])
        s.dispose()
    })

    test("scratch observations and extractor errors roll back mixed writes", () => {
        const entities = define(value => {
            if (value.title === "fail") throw new Error("extract failed")
            return value.kind
        })
        const s = store(),
            count = atom(0),
            a = entities("entity:1")
        const tasks = query(entities, { where: { kind: { eq: "task" } } })
        s.set(a, entity())
        const initial = s.get(tasks)
        expect(() =>
            s.txn(tx => {
                tx.set(count, 1)
                tx.set(a, entity("person"))
                expect(tx.get(tasks)).toEqual([])
                tx.set(a, entity("task", "fail"))
            }),
        ).toThrow("extract failed")
        expect(s.get(count)).toBe(0)
        expect(s.get(a)).toEqual(entity())
        expect(s.get(tasks)).toBe(initial)
        s.txn(tx => {
            tx.set(a, entity("task", "fail"))
            tx.set(a, entity("person"))
        })
        expect(s.get(tasks)).toEqual([])
        s.dispose()
    })

    test("selector dependencies and empty lookup become populated", () => {
        const entities = define(),
            s = store()
        const tasks = query(entities, { where: { kind: { eq: "task" } } })
        const count = selector(get => get(tasks).length)
        expect(s.get(count)).toBe(0)
        const seen: number[] = []
        s.sub(count, () => seen.push(s.get(count)))
        s.set(entities("entity:1"), entity())
        expect(s.get(count)).toBe(1)
        expect(seen).toEqual([1])
        s.dispose()
    })
})

test("seeded scoped transactions agree with the selector full-scan shim", () => {
    let seed = 78123
    const random = (limit: number) => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
        return seed % limit
    }
    const entities = define(),
        root = store()
    const scopes = [
        root,
        root.scope("a"),
        root.scope("b"),
        root.scope("a").scope("deep"),
    ]
    const rows = Array.from({ length: 18 }, (_, i) => entities(`entity:${i}`))
    const tasks = query(entities, { where: { kind: { eq: "task" } } })
    const shim = selector(get =>
        get(entities).filter(row => get(row)?.kind === "task"),
    )
    for (const scope of scopes) scope.get(tasks)
    for (let turn = 0; turn < 500; turn++) {
        const abort = random(9) === 0
        try {
            root.txn(tx => {
                for (
                    let write = 0, count = 1 + random(5);
                    write < count;
                    write++
                ) {
                    const target = tx.scope(scopes[random(scopes.length)]!)
                    const row = rows[random(rows.length)]!
                    switch (random(4)) {
                        case 0:
                            target.delete(row)
                            break
                        case 1:
                            target.reset(row)
                            break
                        default:
                            target.set(
                                row,
                                entity(
                                    random(2) ? "task" : "person",
                                    String(turn),
                                ),
                            )
                            break
                    }
                }
                const target = tx.scope(scopes[random(scopes.length)]!)
                expect(target.get(tasks)).toEqual(
                    target
                        .get(entities)
                        .filter(row => target.get(row)?.kind === "task"),
                )
                if (abort) throw new Error("abort")
            })
        } catch (error) {
            if (!abort) throw error
        }
        for (const scope of scopes)
            expect(scope.get(tasks)).toEqual(scope.get(shim))
    }
    root.dispose()
})

test("rejects async extractors and prevents writes from extractors", () => {
    const s = store(),
        counter = atom(0)
    const asyncEntities = define((() => Promise.resolve("task")) as never)
    s.set(asyncEntities("entity:1"), entity())
    expect(() =>
        s.get(query(asyncEntities, { where: { kind: { eq: "task" } } })),
    ).toThrow("synchronous")
    let attempt = false
    let rejected: unknown
    const entities = define(value => {
        if (attempt) {
            try {
                s.set(counter, 7)
            } catch (error) {
                rejected = error
            }
        }
        return value.kind
    })
    const tasks = query(entities, { where: { kind: { eq: "task" } } })
    s.get(tasks)
    attempt = true
    s.set(entities("entity:1"), entity())
    expect(rejected).toBeInstanceOf(Error)
    expect(s.get(counter)).toBe(0)
    expect(s.get(tasks)).toEqual([entities("entity:1")])
    s.dispose()
})

test("multiple indexes, scalar equality, definition copy and closed grammar", () => {
    const indexes = {
        kind: (value: { kind: string; active: boolean }) => value.kind,
        active: (value: { kind: string; active: boolean }) => value.active,
    }
    const entities = collection<
        number,
        { kind: string; active: boolean },
        number,
        { kind: string; active: boolean }
    >({ indexes })
    indexes.kind = () => "changed"
    const s = store()
    const a = entities(1)
    s.set(a, { kind: "__proto__", active: true })
    const kinds = query(entities, { where: { kind: { eq: "__proto__" } } })
    const active = query(entities, { where: { active: { eq: true } } })
    expect(s.get(kinds)).toEqual([a])
    expect(s.get(active)).toEqual([a])
    s.set(a, { kind: "other", active: false })
    expect(s.get(kinds)).toEqual([])
    expect(s.get(active)).toEqual([])
    expect(() =>
        query(entities, { where: { kind: { eq: "x", gt: "y" } } } as never),
    ).toThrow()
    expect(() =>
        query(entities, { where: { missing: { eq: "x" } } } as never),
    ).toThrow()
    s.dispose()
})

test("coalesces cross-scope writes, transient index moves, and unchanged result notifications", () => {
    let calls = 0
    const entities = define(value => {
        calls++
        return value.kind
    })
    const root = store(),
        child = root.scope("child")
    const a = entities("entity:1"),
        b = entities("entity:2")
    root.txn(tx => {
        tx.set(a, entity())
        tx.set(b, entity())
    })
    const tasks = query(entities, { where: { kind: { eq: "task" } } })
    const parentBefore = root.get(tasks),
        childBefore = child.get(tasks)
    const notices: string[] = []
    root.sub(tasks, () => notices.push("root"))
    child.sub(tasks, () => notices.push("child"))
    calls = 0
    root.txn(tx => {
        tx.set(a, entity("person"))
        tx.set(a, entity("task", "final"))
        const scoped = tx.scope(child)
        scoped.delete(a)
        scoped.reset(a)
    })
    expect(root.get(tasks)).toBe(parentBefore)
    expect(child.get(tasks)).toEqual([b, a])
    expect(child.get(tasks)).not.toBe(childBefore)
    expect(notices).toEqual(["child"])
    expect(calls).toBe(2)
    const same = root.get(a)!
    child.set(a, same)
    calls = 0
    root.set(a, entity("person"))
    expect(child.get(tasks)).toEqual([b, a])
    expect(calls).toBe(1)
    root.dispose()
})

test("first query read after prior scoped writes and independent stores", () => {
    const entities = define(),
        root = store(),
        other = store(),
        child = root.scope("child")
    const a = entities("entity:1"),
        b = entities("entity:2")
    root.set(a, entity())
    child.set(a, entity("person"))
    child.set(b, entity())
    root.delete(a)
    const tasks = query(entities, { where: { kind: { eq: "task" } } })
    expect(child.get(tasks)).toEqual([b])
    expect(root.get(tasks)).toEqual([])
    other.set(a, entity())
    expect(other.get(tasks)).toEqual([a])
    expect(child.get(tasks)).toEqual([b])
    root.dispose()
    other.dispose()
})

test("scalar equality keeps primitive types distinct and normalizes signed zero", () => {
    type Scalar = string | number | boolean | bigint | null
    const rows = collection<
        number,
        { value: Scalar },
        number,
        { value: Scalar }
    >({ indexes: { value: row => row.value } })
    const s = store()
    const values: Scalar[] = [null, false, true, 0, -0, 1, "0", "1", 0n]
    s.txn(tx =>
        values.forEach((value, index) => tx.set(rows(index), { value })),
    )
    for (const value of values) {
        const result = query(rows, { where: { value: { eq: value } } })
        expect(s.get(result)).toEqual(
            values.flatMap((candidate, index) =>
                candidate === value ? [rows(index)] : [],
            ),
        )
    }
    const missing = query(rows, { where: { value: { eq: "missing" } } })
    const empty = s.get(missing)
    for (let i = 0; i < 20; i++) {
        s.set(rows(100), { value: "missing" })
        expect(s.get(missing)).toEqual([rows(100)])
        s.delete(rows(100))
        expect(s.get(missing)).toEqual(empty)
    }
    for (const value of [
        undefined,
        NaN,
        Infinity,
        Symbol("no"),
        {},
        Promise.resolve(0),
    ]) {
        expect(() =>
            query(rows, { where: { value: { eq: value } } } as never),
        ).toThrow()
    }
    s.dispose()
})

test("scratch equality reads invalidate after value-only set/update/reset in the same transaction", () => {
    const entities = define(),
        s = store(),
        child = s.scope("child")
    const a = entities("entity:1")
    s.set(a, entity())
    const tasks = query(entities, { where: { kind: { eq: "task" } } })
    const committed = s.get(tasks)
    s.txn(tx => {
        expect(tx.get(tasks)).toEqual([a])
        tx.set(a, entity("person"))
        expect(tx.get(tasks)).toEqual([])
        tx.update(a, value => ({ ...value, kind: "task" as const }))
        expect(tx.get(tasks)).toEqual([a])
        const scoped = tx.scope(child)
        expect(scoped.get(tasks)).toEqual([a])
        scoped.set(a, entity("person"))
        expect(scoped.get(tasks)).toEqual([])
        scoped.reset(a)
        expect(scoped.get(tasks)).toEqual([a])
    })
    expect(s.get(tasks)).toBe(committed)
    s.dispose()
})
