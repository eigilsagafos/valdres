// Transaction.resetAll(): rebase (clear -> rebuild -> commit) and the
// descendant mirror rule.
import { describe, expect, test } from "bun:test"
import * as V from "../../src/index"
// Public-API scenarios shared with the installed-consumer checks.
import * as S from "./reset-all-rebase.scenarios.mjs"

const keys = (rows: readonly any[]) => rows.map(r => r.key).join(",")
const rng = (seed: number) => {
    let state = seed >>> 0
    return (n: number) => {
        state = (Math.imul(state, 1103515245) + 12345) >>> 0
        return (state >>> 16) % n
    }
}

describe("resetAll rebase", () => {
    test("scenario: clear -> rebuild -> commit", () => {
        expect(S.rebaseDemo(V).filter((r: any) => !r.ok)).toEqual([])
    })
    test("scenario: throw before apply keeps the old draft", () => {
        expect(S.rebaseRollback(V).filter((r: any) => !r.ok)).toEqual([])
    })
    test("scenario: unchanged rebase notifies like existing semantics (nobody)", () => {
        const bulk = S.unchangedRebase(V, "bulk")
        const loop = S.unchangedRebase(V, "loop")
        expect(bulk.notified).toEqual([])
        expect({ ...bulk, mode: "" }).toEqual({ ...loop, mode: "" })
    })
    test("scenario: descendant matrix", () => {
        const bulk: any = S.descendantMatrix(V, "bulk")
        const loop: any = S.descendantMatrix(V, "loop")
        for (const kind of Object.keys(bulk)) {
            for (const step of [
                "before",
                "afterAncestorClear",
                "afterParentAddsZ",
            ]) {
                // values, array reuse and notification counts never differ
                expect(bulk[kind][step].values).toEqual(loop[kind][step].values)
                expect(bulk[kind][step].arrayReused).toBe(
                    loop[kind][step].arrayReused,
                )
                expect(bulk[kind][step].notifications).toEqual(
                    loop[kind][step].notifications,
                )
            }
        }
        // mirroring descendants follow the restored ancestor
        for (const kind of ["untouched", "value override on existing row"])
            expect(bulk[kind].afterAncestorClear.order).toBe("a,b,c,d")
        // descendants with their own membership history behave exactly as today
        for (const kind of [
            "additions and deletions",
            "individually reset (historical order)",
        ])
            for (const step of ["afterAncestorClear", "afterParentAddsZ"])
                expect(bulk[kind][step].order).toBe(loop[kind][step].order)
    })

    test("seeded: non-mirroring descendants equal the per-state loop; mirroring ones equal the ancestor", () => {
        let mirrors = 0
        let independents = 0
        for (let seed = 1; seed <= 200; seed++) {
            const bulk = program(seed, "bulk")
            const loop = program(seed, "loop")
            expect(bulk.ancestorValues).toEqual(loop.ancestorValues)
            bulk.descendants.forEach((d, i) => {
                const l = loop.descendants[i]!
                expect(d.values).toEqual(l.values)
                expect(d.laterValues).toEqual(l.laterValues)
                if (d.mirrored) {
                    mirrors++
                    expect(d.order).toBe(bulk.ancestorOrder)
                    // afterwards ordinary inheritance applies: the ancestor's
                    // later order minus rows this descendant hides locally
                    if (d.laterKeepsOwnRows === false)
                        expect(d.laterOrder).toBe(
                            bulk.laterAncestorOrder
                                .split(",")
                                .filter(k => !d.hidden.includes(k))
                                .join(","),
                        )
                } else {
                    independents++
                    expect(d.order).toBe(l.order)
                    expect(d.laterOrder).toBe(l.laterOrder)
                    expect(d.counts).toEqual(l.counts)
                }
            })
        }
        expect(mirrors).toBeGreaterThan(100)
        expect(independents).toBeGreaterThan(100)
    })
})

const program = (seed: number, mode: "bulk" | "loop") => {
    const rand = rng(seed)
    const rows = V.collection<string, string>()
    const ks = ["a", "b", "c", "d", "e", "f"]
    const root = V.store()
    for (const k of ks) if (rand(3)) root.set(rows(k), k)
    const anc = root.scope("anc")
    const owned = new Set<string>()
    for (let i = 0; i < 5; i++) {
        const k = ks[rand(ks.length)]!
        const op = rand(4)
        if (op === 0) anc.reset(rows(k))
        else if (op === 1) anc.delete(rows(k))
        else anc.set(rows(k), `${k}@anc`)
        owned.add(k)
    }
    const kinds = ["none", "value", "addDelete", "residue"] as const
    const descs = [0, 1, 2].map(i => {
        const desc = anc.scope(`d${i}`)
        const local = new Map<string, "present" | "absent" | "none">()
        const kind = kinds[rand(kinds.length)]!
        const present = new Set(anc.get(rows).map(r => r.key as string))
        if (kind === "value") {
            const candidates = [...present]
            if (candidates.length) {
                const k = candidates[rand(candidates.length)]!
                desc.set(rows(k), `${k}@d${i}`)
                local.set(k, "present")
            }
        } else if (kind === "addDelete") {
            const k = ks[rand(ks.length)]!
            if (rand(2)) {
                desc.delete(rows(k))
                local.set(k, "absent")
            } else {
                desc.set(rows(k), `${k}@d${i}`)
                local.set(k, "present")
            }
        } else if (kind === "residue") {
            const k = ks[rand(ks.length)]!
            desc.delete(rows(k))
            desc.reset(rows(k))
        }
        const counts = { membership: 0 }
        desc.sub(rows, () => counts.membership++)
        return {
            desc,
            local,
            counts,
            before: keys(desc.get(rows)),
            ancBefore: keys(anc.get(rows)),
        }
    })
    root.txn(tx => {
        if (rand(2)) tx.set(rows(ks[rand(ks.length)]!), "root@txn")
        const c = tx.scope(anc)
        if (mode === "bulk") c.resetAll()
        else {
            // explicit loop in the documented order: parent's current order first
            const parentOrder = tx.get(rows).map(r => r.key as string)
            const ordered = [...owned].sort(
                (a, b) =>
                    (parentOrder.includes(a) ? parentOrder.indexOf(a) : 1e9) -
                    (parentOrder.includes(b) ? parentOrder.indexOf(b) : 1e9),
            )
            for (const k of ordered) c.reset(rows(k))
        }
        if (rand(2)) tx.delete(rows(ks[rand(ks.length)]!))
    })
    const ancestorOrder = keys(anc.get(rows))
    const ancPresent = new Set(anc.get(rows).map(r => r.key as string))
    const snapshot = descs.map(
        ({ desc, local, counts, before, ancBefore }) => ({
            mirrored:
                before === ancBefore &&
                [...local].every(
                    ([k, kind]) =>
                        kind === "none" ||
                        (kind === "present") === ancPresent.has(k),
                ),
            order: keys(desc.get(rows)),
            values: ks.map(k => desc.get(rows(k)) ?? null),
            counts: { ...counts },
        }),
    )
    root.set(rows(ks[rand(ks.length)]!), "root@later")
    root.set(rows("z"), "z")
    const laterAncestor = anc.get(rows).map(r => r.key as string)
    return {
        ancestorOrder,
        laterAncestorOrder: laterAncestor.join(","),
        ancestorValues: ks.map(k => anc.get(rows(k)) ?? null),
        descendants: snapshot.map((s, i) => ({
            ...s,
            hidden: [...descs[i]!.local]
                .filter(([, kind]) => kind === "absent")
                .map(([k]) => k),
            laterKeepsOwnRows: [...descs[i]!.local].some(
                ([k, kind]) => kind === "present" && !laterAncestor.includes(k),
            ),
            laterOrder: keys(descs[i]!.desc.get(rows)),
            laterValues: ks.map(k => descs[i]!.desc.get(rows(k)) ?? null),
        })),
    }
}
