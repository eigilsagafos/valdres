import { describe, expect, test } from "bun:test"
import { atom } from "../atom"
import { atomFamily } from "../atomFamily"
import { selector } from "../selector"
import { selectorFamily } from "../selectorFamily"
import { store } from "../store"
import { isLive, reconcileLivenessAfterChurn } from "./mountAtom"

// Regression coverage for the `liveDependentCount` desync fixed by
// `reconcileLivenessAfterChurn`: a selector transitively read by a live
// subscriber was left with `liveDependentCount === undefined` (treated
// non-live) after a dependency churned (dropped + re-added) within a single
// propagation pass, so `propagateDirtySelectors` skipped it forever and it
// returned a stale value (the ShiftX scrub freeze). The canonical end-to-end
// reproduction is the standalone `valdres-livecount-repro` (the real consumer
// selector DAG); these tests guard the core invariant the fix restores:
//
//   liveDependentCount[D] === |{ S : D ∈ stateDependencies[S] AND isLive(S) }|
//
// after every operation, computed from ground truth (NOT the cached count).

let uid = 0
const mulberry32 = (seed: number) => () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

// Ground-truth liveness check over a known set of states.
const checkInvariant = (s: any, states: any[], label: string) => {
    const data = s.data
    const liveTrue = new Set<any>()
    for (const st of states) {
        const subs = data.subscriptions.get(st)
        if (subs && subs.size > 0) liveTrue.add(st)
    }
    let changed = true
    while (changed) {
        changed = false
        for (const T of states) {
            if (!liveTrue.has(T)) continue
            const deps = data.stateDependencies.get(T)
            if (!deps) continue
            for (const D of deps)
                if (states.includes(D) && !liveTrue.has(D)) {
                    liveTrue.add(D)
                    changed = true
                }
        }
    }
    const expected = new Map<any, number>()
    for (const T of states) {
        if (!liveTrue.has(T)) continue
        const deps = data.stateDependencies.get(T)
        if (!deps) continue
        for (const D of deps) expected.set(D, (expected.get(D) ?? 0) + 1)
    }
    for (const D of states) {
        const exp = expected.get(D) ?? 0
        const act = data.liveDependentCount.get(D) ?? 0
        if (act !== exp)
            throw new Error(
                `${label}: liveDependentCount mismatch for ${D.name ?? "?"} — expected ${exp}, got ${act}`,
            )
        const expLive =
            liveTrue.has(D) || (data.subscriptions.get(D)?.size ?? 0) > 0
        if (isLive(D, data) !== expLive)
            throw new Error(
                `${label}: isLive mismatch for ${D.name ?? "?"} — expected ${expLive}, got ${isLive(D, data)}`,
            )
    }
}

describe("liveDependentCount stays consistent across dynamic-dep churn", () => {
    // Fuzz: random dynamic-dependency graphs (deps switch on a control value)
    // with subscription churn + multi-write txns, in a root store and a scope.
    test("fuzz: random dynamic-dep graphs preserve the liveness invariant", () => {
        for (let seed = 1; seed <= 400; seed++) {
            const rnd = mulberry32(seed)
            const run = ++uid
            const nAtoms = 3 + Math.floor(rnd() * 4)
            const nSel = 10 + Math.floor(rnd() * 10)
            const pick = (n: number, max: number) => {
                const out: number[] = []
                for (let j = 0; j < n; j++) out.push(Math.floor(rnd() * max))
                return out
            }
            const atoms = Array.from({ length: nAtoms }, (_, i) =>
                atom(0, { name: `lr_a${i}.${run}` }),
            )
            const sels: any[] = []
            const defs = Array.from({ length: nSel }, (_, i) => ({
                ctrl: { atom: Math.floor(rnd() * nAtoms) },
                a: pick(1 + Math.floor(rnd() * 2), nAtoms),
                b: pick(Math.floor(rnd() * 3), nAtoms),
                sa: i > 0 ? pick(1 + Math.floor(rnd() * 3), i) : [],
                sb: i > 0 ? pick(Math.floor(rnd() * 3), i) : [],
            }))
            defs.forEach((def, i) => {
                sels.push(
                    selector(
                        (get: any) => {
                            const ctrl = get(atoms[def.ctrl.atom])
                            let acc = ctrl % 3
                            if (ctrl % 2 === 0) {
                                for (const ai of def.a) acc += get(atoms[ai])
                                for (const si of def.sa)
                                    if (si < i) acc += get(sels[si])
                            } else {
                                for (const ai of def.b) acc += get(atoms[ai])
                                for (const si of def.sb)
                                    if (si < i) acc += get(sels[si])
                            }
                            return acc
                        },
                        { name: `lr_s${i}.${run}` },
                    ),
                )
            })
            const states = [...atoms, ...sels]
            const root = store("lr_gs" + run)
            const ctx: any = rnd() < 0.5 ? root.scope("draft") : root
            const subs = new Map<number, () => void>()
            const toggle = (si: number) => {
                if (subs.has(si)) {
                    subs.get(si)!()
                    subs.delete(si)
                } else subs.set(si, ctx.sub(sels[si], () => {}))
            }
            for (let si = 0; si < nSel; si++) if (rnd() < 0.5) toggle(si)
            checkInvariant(ctx, states, `seed=${seed} init`)
            for (let step = 0; step < 25; step++) {
                const writes = 1 + Math.floor(rnd() * nAtoms)
                ctx.txn((t: any) => {
                    for (let w = 0; w < writes; w++)
                        t.set(atoms[Math.floor(rnd() * nAtoms)], Math.floor(rnd() * 6))
                })
                const churn = Math.floor(rnd() * 3)
                for (let c = 0; c < churn; c++) toggle(Math.floor(rnd() * nSel))
                checkInvariant(ctx, states, `seed=${seed} step=${step}`)
            }
            for (const u of subs.values()) u()
        }
    })

    // Layered graph (closer to the ShiftX shape): only TOP-layer selectors are
    // subscribed (stable anchors); deep layers have data-dependent deps that
    // collapse and regrow as control atoms churn en masse in single txns.
    test("fuzz: top-subscribed layered graph survives mass collapse→regrow", () => {
        for (let seed = 1; seed <= 400; seed++) {
            const rnd = mulberry32(seed)
            const run = ++uid
            const LAYERS = 4 + Math.floor(rnd() * 3)
            const W = 3 + Math.floor(rnd() * 3)
            const nCtrl = 2 + Math.floor(rnd() * 3)
            const ctrls = Array.from({ length: nCtrl }, (_, i) =>
                atom(1, { name: `ll_c${i}.${run}` }),
            )
            const layers: any[][] = []
            for (let l = 0; l < LAYERS; l++) {
                const layer: any[] = []
                for (let w = 0; w < W; w++) {
                    const myCtrl = Math.floor(rnd() * nCtrl)
                    const gate = Math.floor(rnd() * nCtrl)
                    const lower = layers[l - 1] ?? []
                    const aPick = Array.from(
                        { length: 1 + Math.floor(rnd() * 2) },
                        () => Math.floor(rnd() * Math.max(1, lower.length)),
                    )
                    const bPick = Array.from(
                        { length: Math.floor(rnd() * 3) },
                        () => Math.floor(rnd() * Math.max(1, lower.length)),
                    )
                    layer.push(
                        selector(
                            (get: any) => {
                                let acc = get(ctrls[myCtrl]) % 5
                                if (lower.length === 0) return acc
                                if (get(ctrls[gate]) > 0) {
                                    for (const i of aPick) acc += get(lower[i])
                                } else {
                                    for (const i of bPick) acc += get(lower[i])
                                }
                                return acc
                            },
                            { name: `ll_s${l}_${w}.${run}` },
                        ),
                    )
                }
                layers.push(layer)
            }
            const top = layers[LAYERS - 1]
            const states = [...ctrls, ...layers.flat()]
            const root = store("ll_gs" + run)
            const ctx: any = rnd() < 0.5 ? root.scope("draft") : root
            const unsubs = top.filter(() => rnd() < 0.8).map(sel => ctx.sub(sel, () => {}))
            if (unsubs.length === 0) unsubs.push(ctx.sub(top[0], () => {}))
            checkInvariant(ctx, states, `seed=${seed} init`)
            for (let step = 0; step < 10; step++) {
                ctx.txn((t: any) => {
                    for (const c of ctrls) if (rnd() < 0.7) t.set(c, 0)
                })
                checkInvariant(ctx, states, `seed=${seed} step=${step} collapse`)
                ctx.txn((t: any) => {
                    for (const c of ctrls) t.set(c, 1 + Math.floor(rnd() * 4))
                })
                checkInvariant(ctx, states, `seed=${seed} step=${step} regrow`)
            }
            for (const u of unsubs) u()
        }
    })

    // Directed: a stable subscribed root reads a per-item selector family whose
    // members read a SHARED leaf selector; collapse the item set to empty and
    // regrow it (the structural skeleton of the ShiftX freeze).
    test("shared leaf re-lives after a per-item collapse→regrow round trip", () => {
        const run = ++uid
        const list = atom<string[]>([], { name: `ld_list.${run}` })
        const ent = atomFamily<{ v: number } | null>(() => ({ v: 1 }), {
            name: `ld_ent.${run}`,
        })
        const leaf = selectorFamily<number, [string]>(
            id => get => get(ent(id))?.v ?? -1,
            { name: `ld_leaf.${run}` },
        )
        const item = selectorFamily<number, [string]>(
            id => get => get(ent(id))!.v + get(leaf(id)),
            { name: `ld_item.${run}` },
        )
        const root = selector(
            get => {
                let acc = 0
                for (const id of get(list)) acc += get(item(id))
                return acc
            },
            { name: `ld_root.${run}` },
        )
        const s = store("ld_gs").scope("draft")
        s.sub(root, () => {})
        s.set(list, ["a", "b", "c"])
        expect(s.get(root)).toBe(6)
        for (const id of ["a", "b", "c"])
            expect(typeof s.data.liveDependentCount.get(leaf(id))).toBe("number")
        // collapse to empty
        s.txn(t => {
            t.set(list, [])
            for (const id of ["a", "b", "c"]) t.set(ent(id), null)
        })
        // regrow
        s.txn(t => {
            t.set(list, ["a", "b", "c"])
            for (const id of ["a", "b", "c"]) t.set(ent(id), { v: 1 })
        })
        // shared leaf must be live again, and a deep change must propagate
        for (const id of ["a", "b", "c"]) {
            expect(typeof s.data.liveDependentCount.get(leaf(id))).toBe("number")
            expect(s.data.liveDependentCount.get(leaf(id))).toBeGreaterThan(0)
        }
        s.set(ent("a"), { v: 99 })
        expect(s.get(root)).toBe(6 - 2 + 198)
    })

    // Direct unit test of the repair contract: hand-corrupt a transitive
    // subtree's liveDependentCount to `undefined` (exactly what the eager
    // teardown-without-restore leaves behind), then `reconcileLivenessAfterChurn`
    // must re-derive it from ground truth using the still-live outside
    // subscriber as the base. This FAILS if the function regresses (wrong
    // region, broken fixpoint, or lost outside-region authority) — unlike the
    // end-to-end freeze, which no synthetic graph reproduces (it needs the real
    // consumer DAG; see the standalone `valdres-livecount-repro`).
    test("reconcileLivenessAfterChurn repairs a corrupted transitive subtree", () => {
        const run = ++uid
        const a = atom(1, { name: `lu_a.${run}` })
        const leaf = selector(get => get(a) + 1, { name: `lu_leaf.${run}` })
        const mid = selector(get => get(leaf) + 1, { name: `lu_mid.${run}` })
        const root = selector(get => get(mid) + 1, { name: `lu_root.${run}` })
        const s = store("lu_gs" + run)
        s.sub(root, () => {})
        s.get(root)
        // healthy: every link counts exactly one live dependent
        expect(s.data.liveDependentCount.get(mid)).toBe(1)
        expect(s.data.liveDependentCount.get(leaf)).toBe(1)
        expect(s.data.liveDependentCount.get(a)).toBe(1)

        // simulate the bug: a teardown dropped the subtree's counts and the
        // re-add was skipped, so mid/leaf/a read as non-live though `root`
        // (subscribed, outside the churn) still transitively reads them.
        s.data.liveDependentCount.delete(mid)
        s.data.liveDependentCount.delete(leaf)
        s.data.liveDependentCount.delete(a)
        expect(isLive(leaf, s.data)).toBe(false) // corrupted

        // reconcile the region seeded by the "removed" intermediate.
        reconcileLivenessAfterChurn(new Set([mid as any]), s.data)

        expect(s.data.liveDependentCount.get(mid)).toBe(1)
        expect(s.data.liveDependentCount.get(leaf)).toBe(1)
        expect(s.data.liveDependentCount.get(a)).toBe(1)
        expect(isLive(leaf, s.data)).toBe(true)
    })
})
