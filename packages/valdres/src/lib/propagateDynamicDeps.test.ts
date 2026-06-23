import { describe, expect, mock, test } from "bun:test"
import { atom } from "../atom"
import { selector } from "../selector"
import { store } from "../store"

// Atom names register in a process-global registry (duplicates throw), so
// atoms built per run get a unique suffix. Selector names are unaffected.
let uid = 0

// Shared fuzz helpers (used by both fuzz tests below) — kept at file scope so the
// two oracles can't drift. `inst` suffixes atom names with a per-build `++uid`, so
// names stay globally unique no matter how many builds run in this process.
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

    test("stranded aggregate is settled once after upstream revisits", () => {
        const defs = [
            {
                deps: [1, 2],
                selDeps: [],
                altSelDeps: [],
                ctrl: { atom: 0 },
                mode: 0,
            },
            {
                deps: [4, 1, 4],
                selDeps: [0],
                altSelDeps: [],
                ctrl: { sel: 0 },
                mode: 1,
            },
            {
                deps: [2, 0],
                selDeps: [1, 0],
                altSelDeps: [1, 1],
                ctrl: { atom: 4 },
                mode: 2,
            },
            {
                deps: [1, 2, 1],
                selDeps: [],
                altSelDeps: [],
                ctrl: { atom: 2 },
                mode: 1,
            },
            {
                deps: [4, 2],
                selDeps: [2, 2],
                altSelDeps: [],
                ctrl: { atom: 4 },
                mode: 0,
            },
            {
                deps: [1, 3],
                selDeps: [],
                altSelDeps: [],
                ctrl: { sel: 1 },
                mode: 0,
            },
            {
                deps: [1],
                selDeps: [],
                altSelDeps: [0],
                ctrl: { atom: 2 },
                mode: 0,
            },
            {
                deps: [2, 0],
                selDeps: [4],
                altSelDeps: [],
                ctrl: { sel: 6 },
                mode: 0,
            },
            {
                deps: [2],
                selDeps: [5, 7],
                altSelDeps: [],
                ctrl: { sel: 3 },
                mode: 2,
            },
            {
                deps: [0],
                selDeps: [0, 0],
                altSelDeps: [2],
                ctrl: { atom: 2 },
                mode: 2,
            },
        ] as const
        const build = () => {
            const run = ++uid
            const atoms = Array.from({ length: 5 }, (_, i) =>
                atom(i, { name: `a${i}.${run}` }),
            )
            const sels: any[] = []
            defs.forEach((def, idx) => {
                sels.push(
                    selector(
                        get => {
                            const ctrl =
                                "atom" in def.ctrl
                                    ? get(atoms[def.ctrl.atom])
                                    : get(sels[def.ctrl.sel])
                            let acc = def.mode + (ctrl % 3)
                            if (ctrl % 2 === 0) {
                                for (const di of def.deps) acc += get(atoms[di])
                                for (const si of def.selDeps)
                                    acc += get(sels[si])
                            } else {
                                for (const si of def.altSelDeps)
                                    acc += get(sels[si]) * 2
                            }
                            return acc
                        },
                        { name: `s${idx}` },
                    ),
                )
            })
            const aggregateCallback = mock(get => {
                let total = 0
                for (const sel of sels) total += get(sel)
                return total
            })
            const aggregate = selector(aggregateCallback, {
                name: `strandedAggregate.${run}`,
            })
            return { atoms, sels, aggregate, aggregateCallback }
        }

        const { atoms, sels, aggregate, aggregateCallback } = build()
        const root = store()
        const s = root.scope("stranded-aggregate")
        const subs: (null | (() => void))[] = sels.map(sel =>
            s.sub(sel, () => {}),
        )
        s.sub(aggregate, () => {})
        s.get(aggregate)
        subs[7]!()
        subs[7] = null
        subs[0]!()
        subs[0] = null
        s.set(atoms[0], 18)

        const callsBeforeStrandedUpdate = aggregateCallback.mock.calls.length
        s.set(atoms[2], 16)

        const o = build()
        const oRoot = store()
        const os = oRoot.scope("stranded-aggregate")
        os.set(o.atoms[0], 18)
        os.set(o.atoms[2], 16)

        expect(s.get(aggregate)).toBe(os.get(o.aggregate))
        expect(
            aggregateCallback.mock.calls.length - callsBeforeStrandedUpdate,
        ).toBe(1)
    })

    // Random dynamic-dependency graphs (branch keyed on a derived selector,
    // dropping/re-adding selector deps) with subscribe/unsubscribe churn, in
    // both a root store and a scope. Each step is checked against a fresh store
    // replaying the identical op sequence — any divergence is a stale selector.
    test("fuzz: incremental store matches fresh-replay oracle", () => {
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

    // Regression for the scope-shadow-on-equal bug: `scope.set(atom, v)` must
    // establish the scope's shadow even when `v` equals the value currently
    // INHERITED from the parent — otherwise the scope keeps tracking the parent
    // and a later parent write to that atom leaks in, silently dropping the
    // explicit override. (setAtom short-circuited on `areEqual` before writing
    // the shadow; the txn path in writeAtoms already pinned equal values.)
    //
    // The fuzz above never caught this: its oracle REPLAYS the same ops in the
    // same order, so when a scope set was order-dependently dropped, the oracle
    // dropped it identically and the two agreed. This oracle is ORDER-INDEPENDENT
    // — it derives each atom's expected scope value from a model (the scope's own
    // last set if it ever set the atom, else read-through to the root's last set)
    // and applies the root values before the scope shadows, so the scope's
    // explicit set is always the last write and the shadow is guaranteed to pin.
    test("fuzz: scope shadows pin regardless of set order (order-independent oracle)", () => {
        for (let seed = 1; seed <= 300; seed++) {
            const rnd = mulberry32(seed)
            const nAtoms = 3 + Math.floor(rnd() * 4)
            const nSelectors = 10 + Math.floor(rnd() * 12)
            const g = buildGraph(rnd, nAtoms, nSelectors)
            const I = inst(g)
            const root = store()
            const child: any = root.scope("child")

            // Order-independent model: per atom, the root's last set (default = i)
            // and the scope's own last set (if it ever set it).
            const rootVal = Array.from({ length: nAtoms }, (_, i) => i)
            const scopeSet = new Array(nAtoms).fill(false)
            const scopeVal = new Array(nAtoms).fill(0)

            const subbed: (null | (() => void))[] = new Array(nSelectors).fill(null)
            const toggle = (si: number) => {
                if (subbed[si]) { subbed[si]!(); subbed[si] = null }
                else subbed[si] = child.sub(I.sels[si], () => {})
            }
            for (let si = 0; si < nSelectors; si++) if (rnd() < 0.6) toggle(si)

            for (let step = 0; step < 40; step++) {
                const churn = Math.floor(rnd() * 3)
                for (let c = 0; c < churn; c++) toggle(Math.floor(rnd() * nSelectors))
                // Interleave individual root and scope sets in random order — the
                // very mix that order-dependent shadow creation got wrong.
                const m = 1 + Math.floor(rnd() * 3)
                for (let j = 0; j < m; j++) {
                    const ai = Math.floor(rnd() * nAtoms)
                    const v = Math.floor(rnd() * 20)
                    if (rnd() < 0.5) {
                        root.set(I.atoms[ai], v)
                        rootVal[ai] = v
                    } else {
                        child.set(I.atoms[ai], v)
                        scopeSet[ai] = true
                        scopeVal[ai] = v
                    }
                }

                // Fresh oracle from the model: apply ALL root values first, then the
                // scope shadows, so each scope set is the last write for its atom and
                // the shadow is guaranteed to pin — independent of the live store's
                // interleaving.
                const oI = inst(g)
                const oRoot = store()
                const oChild: any = oRoot.scope("child")
                for (let ai = 0; ai < nAtoms; ai++) oRoot.set(oI.atoms[ai], rootVal[ai])
                for (let ai = 0; ai < nAtoms; ai++) if (scopeSet[ai]) oChild.set(oI.atoms[ai], scopeVal[ai])

                for (let si = 0; si < nSelectors; si++) {
                    if (!subbed[si]) continue
                    expect(child.get(I.sels[si])).toBe(oChild.get(oI.sels[si]))
                }
            }
            subbed.forEach(u => u && u())
        }
    })

    // Regression for the 1.0.0-beta wide-fan-in re-evaluation blow-up: a
    // subscribed aggregator with dynamic deps that reads many upstream selectors
    // was re-evaluated roughly once per dependency on a single commit. This
    // seed produced ~169 evaluations of one selector before the fix.
    test("wide fan-in aggregator is not re-evaluated once per dependency", () => {
        const mulberry32 = (seed: number) => () => {
            seed |= 0
            seed = (seed + 0x6d2b79f5) | 0
            let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296
        }
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
            const run = ++uid
            const atoms = Array.from({ length: nAtoms }, (_, i) => atom(i, { name: `wfi-a${i}.${run}` }))
            const sels: any[] = []
            defs.forEach((def, idx) => {
                sels.push(selector(get => {
                    if (countEvals) evals.set(idx, (evals.get(idx) ?? 0) + 1)
                    const ctrl = "atom" in def.ctrl ? get(atoms[def.ctrl.atom]) : get(sels[def.ctrl.sel])
                    let acc = def.mode + (ctrl % 3)
                    if (ctrl % 2 === 0) {
                        for (const di of def.deps) acc += get(atoms[di])
                        for (const si of def.selDeps) acc += get(sels[si])
                    } else {
                        for (const si of def.altSelDeps) acc += get(sels[si]) * 2
                    }
                    return acc
                }, { name: `wfi-s${idx}.${run}` }))
            })
            return { atoms, sels }
        }

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
        const nChanged = 1 + Math.floor(rnd() * 4)
        const changed: { ai: number; v: number }[] = []
        for (let k = 0; k < nChanged; k++)
            changed.push({ ai: Math.floor(rnd() * nAtoms), v: 100 + Math.floor(rnd() * 50) })
        child.txn(({ set }) => {
            for (const c of changed) set(I.atoms[c.ai], c.v)
        })

        let maxEvals = 0
        for (const n of evals.values()) if (n > maxEvals) maxEvals = n
        unsubs.forEach(u => u())
        expect(maxEvals).toBeLessThan(40)

        const O = inst(false)
        const oRoot = store()
        const oChild = oRoot.scope("draft")
        for (const c of changed) oChild.set(O.atoms[c.ai], c.v)
        for (let i = 0; i < nSelectors; i++) {
            expect(child.get(I.sels[i])).toBe(oChild.get(O.sels[i]))
        }
    })
})
