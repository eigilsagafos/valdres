import { describe, expect, test } from "bun:test"
import { atom } from "../atom"
import { selector } from "../selector"
import { store } from "../store"

// Atom names register in a process-global registry (duplicates throw), so
// atoms built per run get a unique suffix. Selector names are unaffected.
let uid = 0

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
            const run = ++uid
            const atoms = Array.from({ length: 5 }, (_, i) => atom(i, { name: `a${i}.${run}` }))
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
            const run = ++uid
            const atoms = Array.from({ length: g.nAtoms }, (_, i) => atom(i, { name: `a${i}.${run}` }))
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
    })

    // Regression for the 1.0.0-beta wide-fan-in re-evaluation blow-up: a
    // subscribed aggregator with DYNAMIC (conditional) deps that reads many
    // upstream selectors was re-evaluated ~once PER dependency on a single
    // commit, instead of ~once. Cause: the topo walk's `pending` counter was a
    // static snapshot, but `advance` decrements against the live `stateDependents`
    // that dynamic-dep churn mutates — driving the count negative and re-pushing
    // the node once per extra parent, which a wide fan-in amplifies into a
    // ~per-dependency cascade (e.g. 169 evaluations of one selector for a
    // 3-atom commit on a 33-node graph). The fix caps each selector at one
    // evaluation per topo walk. This asserts the eval count stays a small
    // constant (NOT proportional to fan-in), AND that values stay correct.
    test("wide fan-in aggregator is not re-evaluated once per dependency", () => {
        const mulberry32 = (seed: number) => () => {
            seed |= 0
            seed = (seed + 0x6d2b79f5) | 0
            let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296
        }
        // A graph with a few "wide" aggregators near the end, each reading ALL
        // earlier selectors, every selector branching on a control value so its
        // dep set varies between evaluations (dynamic deps). Mirrors the shape
        // that regressed: a subscribed wide-fan-in aggregator over a dynamic-dep
        // subgraph. Seed chosen because it produced one of the worst blow-ups
        // (169 evals of a single selector) before the fix.
        // The RNG drives the graph, the subscribed subset, and the commit, in a
        // fixed order — this seed is one that produced a ~169-evaluation blow-up
        // of a single wide aggregator before the fix.
        const seed = 1147
        const rnd = mulberry32(seed)
        const nAtoms = 4 + Math.floor(rnd() * 6)
        const nSelectors = 12 + Math.floor(rnd() * 24)
        const evals = new Map<number, number>()
        const defs: any[] = []
        for (let i = 0; i < nSelectors; i++) {
            const pick = (n: number, max: number) => {
                const out: number[] = []
                for (let j = 0; j < n; j++) out.push(Math.floor(rnd() * max))
                return out
            }
            // Last few selectors are wide aggregators reading ALL earlier ones.
            const wide = i >= nSelectors - 3 && i > 4
            defs.push({
                ctrl: i > 0 && rnd() < 0.6 ? { sel: Math.floor(rnd() * i) } : { atom: Math.floor(rnd() * nAtoms) },
                deps: pick(1 + Math.floor(rnd() * 3), nAtoms),
                selDeps: wide ? Array.from({ length: i }, (_, k) => k) : i > 0 ? pick(Math.floor(rnd() * 3), i) : [],
                altSelDeps: i > 0 ? pick(Math.floor(rnd() * 3), i) : [],
                mode: Math.floor(rnd() * 3),
            })
        }
        const inst = (countEvals: boolean) => {
            const r = ++uid
            const as = Array.from({ length: nAtoms }, (_, i) => atom(i, { name: `wfi-a${i}.${r}` }))
            const sels: any[] = []
            defs.forEach((def, idx) => {
                sels.push(selector(get => {
                    if (countEvals) evals.set(idx, (evals.get(idx) ?? 0) + 1)
                    const ctrl = "atom" in def.ctrl ? get(as[def.ctrl.atom]) : get(sels[def.ctrl.sel])
                    let acc = def.mode + (ctrl % 3)
                    if (ctrl % 2 === 0) {
                        for (const di of def.deps) acc += get(as[di])
                        for (const si of def.selDeps) acc += get(sels[si])
                    } else {
                        for (const si of def.altSelDeps) acc += get(sels[si]) * 2
                    }
                    return acc
                }, { name: `wfi-s${idx}.${r}` }))
            })
            return { as, sels }
        }

        // Live store in a scope. A random subset of selectors is subscribed
        // (mounted components), plus every wide aggregator — matching the shape
        // that regressed. RNG order below mirrors the search that found this seed.
        const I = inst(true)
        const root = store()
        const child = root.scope("draft")
        const unsubs: (() => void)[] = []
        for (let i = 0; i < nSelectors; i++)
            if (rnd() < 0.5) unsubs.push(child.sub(I.sels[i], () => {}))
        for (let i = Math.max(0, nSelectors - 3); i < nSelectors; i++)
            unsubs.push(child.sub(I.sels[i], () => {}))
        for (let i = 0; i < nSelectors; i++) child.get(I.sels[i])

        evals.clear()
        // One commit changing a handful of upstream atoms (as a reparent does).
        const nChanged = 1 + Math.floor(rnd() * 4)
        const changed: { ai: number; v: number }[] = []
        for (let k = 0; k < nChanged; k++)
            changed.push({ ai: Math.floor(rnd() * nAtoms), v: 100 + Math.floor(rnd() * 50) })
        child.txn(({ set }) => {
            for (const c of changed) set(I.as[c.ai], c.v)
        })

        let maxEvals = 0
        for (const n of evals.values()) if (n > maxEvals) maxEvals = n
        unsubs.forEach(u => u())

        // Before the fix this hit ~169 for this graph. A correct topo walk
        // evaluates each selector ~once per commit; allow generous headroom for
        // bounded re-settles under dynamic-dep churn, but far below per-dependency.
        expect(maxEvals).toBeLessThan(40)

        // Correctness: every selector matches a fresh store with the same final
        // atom state — the eval-count cap must not come at the cost of staleness.
        const O = inst(false)
        const oRoot = store()
        const oChild = oRoot.scope("draft")
        for (const c of changed) oChild.set(O.as[c.ai], c.v)
        for (let i = 0; i < nSelectors; i++) {
            expect(child.get(I.sels[i])).toBe(oChild.get(O.sels[i]))
        }
    })
})
