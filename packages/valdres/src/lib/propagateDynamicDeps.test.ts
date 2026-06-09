import { describe, expect, test } from "bun:test"
import { atom } from "../atom"
import { selector } from "../selector"
import { store } from "../store"

// Regression tests for a selector-invalidation bug introduced when selector
// update propagation moved to a static topological closure (1.0.0-beta.4).
//
// The closure + per-node `pending` counts are a snapshot of the dependency
// graph taken before propagation runs. They assume the graph is fixed for the
// duration of the walk. But a selector can be re-evaluated OUT OF BAND during
// the walk — most commonly lazily re-initialized via `get` when another
// selector reads it after its value was dropped by orphan-invalidation /
// unsubscribe. That re-eval mutates the dependency graph mid-walk, which left
// two classes of node permanently stale:
//
//  1. ESCAPED: a node materialized after the closure was built is absent from
//     the closure, so `advance()` skipped it when one of its dependencies
//     settled to a new value.
//  2. STRANDED: a node in the closure that drops a dependency it was
//     snapshotted with — the dropped parent's reverse edge is gone, so it never
//     decrements the node's `pending`, which stalls above 0 so the node is
//     never processed.
//
// Both surface as "a selector whose dependency changed value was never
// re-evaluated", which is exactly what broke dynamic ("dragging" vs "settled")
// branch toggles in consuming apps.

describe("dynamic-dependency propagation", () => {
    // Mirrors the minimal failing graph: an orphaned selector (s7) is lazily
    // re-initialized when a live selector (s8) reads it across a branch toggle,
    // reading a still-mid-flight dependency (s4), then is dropped from the
    // static closure so the later settle of s4 never reaches it.
    test("escaped node: orphan re-read across branch toggle stays fresh", () => {
        const defs = [
            { deps: [1, 2], selDeps: [], altSelDeps: [], ctrl: { atom: 0 }, mode: 0 },
            { deps: [4, 1, 4], selDeps: [0], altSelDeps: [], ctrl: { sel: 0 }, mode: 1 },
            { deps: [2, 0], selDeps: [1, 0], altSelDeps: [1, 1], ctrl: { atom: 4 }, mode: 2 },
            { deps: [1, 2, 1], selDeps: [], altSelDeps: [], ctrl: { atom: 2 }, mode: 1 },
            { deps: [4, 2], selDeps: [2, 2], altSelDeps: [], ctrl: { atom: 4 }, mode: 0 },
            { deps: [1, 3], selDeps: [], altSelDeps: [], ctrl: { sel: 1 }, mode: 0 },
            { deps: [1], selDeps: [], altSelDeps: [0], ctrl: { atom: 2 }, mode: 0 },
            { deps: [2, 0], selDeps: [4], altSelDeps: [], ctrl: { sel: 6 }, mode: 0 },
            { deps: [2], selDeps: [5, 7], altSelDeps: [], ctrl: { sel: 3 }, mode: 2 },
            { deps: [0], selDeps: [0, 0], altSelDeps: [2], ctrl: { atom: 2 }, mode: 2 },
        ] as const
        const build = () => {
            const atoms = Array.from({ length: 5 }, (_, i) => atom(i, { name: `a${i}` }))
            const sels: any[] = []
            defs.forEach((def, idx) => {
                sels.push(selector(get => {
                    const ctrl = "atom" in def.ctrl ? get(atoms[def.ctrl.atom]) : get(sels[def.ctrl.sel])
                    let acc = def.mode + (ctrl % 3)
                    if (ctrl % 2 === 0) {
                        for (const di of def.deps) acc += get(atoms[di])
                        for (const si of def.selDeps) acc += get(sels[si])
                    } else {
                        for (const si of def.altSelDeps) acc += get(sels[si]) * 2
                    }
                    return acc
                }, { name: `s${idx}` }))
            })
            return { atoms, sels }
        }

        const { atoms, sels } = build()
        const s = store()
        const subs: (null | (() => void))[] = sels.map(sel => s.sub(sel, () => {}))
        // orphan s7 and s0 (s7's only would-be live consumer s8 is on its other
        // branch, so s7's value is dropped)
        subs[7]!(); subs[7] = null
        subs[0]!(); subs[0] = null
        s.set(atoms[0], 18)
        s.set(atoms[2], 16)

        const o = build()
        const os = store()
        os.set(o.atoms[0], 18)
        os.set(o.atoms[2], 16)

        for (let i = 0; i < sels.length; i++) {
            if (!subs[i]) continue
            expect(s.get(sels[i])).toBe(os.get(o.sels[i]))
        }
    })

    // Random dynamic-dependency graphs (branch keyed on a derived selector,
    // dropping/re-adding selector deps) with subscribe/unsubscribe churn, in
    // both a root store and a scope. Each step is checked against a fresh store
    // replaying the identical op sequence — any divergence is a stale selector.
    test("fuzz: incremental store matches fresh-replay oracle", () => {
        const mulberry32 = (seed: number) => () => {
            seed |= 0
            seed = (seed + 0x6d2b79f5) | 0
            let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296
        }
        const buildGraph = (rnd: () => number, nAtoms: number, nSelectors: number) => {
            const selDefs: any[] = []
            for (let i = 0; i < nSelectors; i++) {
                const pick = (n: number, max: number) => {
                    const out: number[] = []
                    for (let j = 0; j < n; j++) out.push(Math.floor(rnd() * max))
                    return out
                }
                selDefs.push({
                    deps: pick(1 + Math.floor(rnd() * 3), nAtoms),
                    selDeps: i > 0 ? pick(Math.floor(rnd() * 3), i) : [],
                    altSelDeps: i > 0 ? pick(Math.floor(rnd() * 3), i) : [],
                    ctrl: i > 0 && rnd() < 0.6 ? { sel: Math.floor(rnd() * i) } : { atom: Math.floor(rnd() * nAtoms) },
                    mode: Math.floor(rnd() * 3),
                })
            }
            return { nAtoms, selDefs }
        }
        const inst = (g: any) => {
            const atoms = Array.from({ length: g.nAtoms }, (_, i) => atom(i, { name: `a${i}` }))
            const sels: any[] = []
            g.selDefs.forEach((def: any, idx: number) => {
                sels.push(selector(get => {
                    const ctrl = "atom" in def.ctrl ? get(atoms[def.ctrl.atom]) : get(sels[def.ctrl.sel])
                    let acc = def.mode + (ctrl % 3)
                    if (ctrl % 2 === 0) {
                        for (const di of def.deps) acc += get(atoms[di])
                        for (const si of def.selDeps) acc += get(sels[si])
                    } else {
                        for (const si of def.altSelDeps) acc += get(sels[si]) * 2
                    }
                    return acc
                }, { name: `s${idx}` }))
            })
            return { atoms, sels }
        }

        for (let seed = 1; seed <= 200; seed++) {
            const rnd = mulberry32(seed)
            const nAtoms = 3 + Math.floor(rnd() * 4)
            const nSelectors = 10 + Math.floor(rnd() * 12)
            const g = buildGraph(rnd, nAtoms, nSelectors)
            const I = inst(g)
            const root = store()
            const useScope = rnd() < 0.5
            const child: any = useScope ? root.scope("child") : root

            const ops: { target: "r" | "c"; ai: number; v: number }[] = []
            const doOp = (op: { target: "r" | "c"; ai: number; v: number }) => {
                ops.push(op)
                if (op.target === "r") root.set(I.atoms[op.ai], op.v)
                else child.set(I.atoms[op.ai], op.v)
            }
            if (useScope) {
                for (let ai = 0; ai < nAtoms; ai++) if (rnd() < 0.4) doOp({ target: "c", ai, v: Math.floor(rnd() * 20) })
            }
            const subbed: (null | (() => void))[] = new Array(nSelectors).fill(null)
            const toggle = (si: number) => {
                if (subbed[si]) { subbed[si]!(); subbed[si] = null }
                else subbed[si] = child.sub(I.sels[si], () => {})
            }
            for (let si = 0; si < nSelectors; si++) if (rnd() < 0.6) toggle(si)

            for (let step = 0; step < 40; step++) {
                const churn = Math.floor(rnd() * 3)
                for (let c = 0; c < churn; c++) toggle(Math.floor(rnd() * nSelectors))
                const m = 1 + Math.floor(rnd() * 3)
                for (let j = 0; j < m; j++) {
                    const ai = Math.floor(rnd() * nAtoms)
                    const v = Math.floor(rnd() * 20)
                    doOp({ target: useScope && rnd() < 0.5 ? "c" : "r", ai, v })
                }

                const oI = inst(g)
                const oRoot = store()
                const oChild: any = useScope ? oRoot.scope("child") : oRoot
                for (const op of ops) {
                    if (op.target === "r") oRoot.set(oI.atoms[op.ai], op.v)
                    else oChild.set(oI.atoms[op.ai], op.v)
                }
                for (let si = 0; si < nSelectors; si++) {
                    if (!subbed[si]) continue
                    expect(child.get(I.sels[si])).toBe(oChild.get(oI.sels[si]))
                }
            }
            subbed.forEach(u => u && u())
        }
    }, 30_000)
})
