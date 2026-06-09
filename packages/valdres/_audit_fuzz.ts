/**
 * Propagation soundness fuzzer (audit deliverable backbone).
 *
 * Differential property test for the selector-propagation engine
 * (propagateDownstreamTopo + scopes + liveness). NOT a unit test — run with
 *   bun packages/valdres/_audit_fuzz.ts [maxSeed]
 *
 * Oracle = a from-scratch recompute that shares the EXACT `compute()` function
 * with the valdres selector bodies. The only way the engine's stored value can
 * differ from `compute(def, freshRecompute)` is a genuinely stale stored value.
 * This is the fixpoint the beta.3 multi-pass cascade provably converges to, so
 * it doubles as the requested beta.3 differential (strictly stronger: it is the
 * ground truth, not another bookkeeping engine).
 *
 * Plus three structural invariants checked after every committed mutation:
 *   (1) stateDependencies / stateDependents are mutual inverses
 *   (2) liveDependentCount equals an independently recomputed live-dependent count
 *   (3) no live selector has a deleted (!data.values.has) value
 */

import { atom } from "./src/atom"
import { selector } from "./src/selector"
import { store } from "./src/store"

// ----------------------------- PRNG -----------------------------
const mulberry32 = (seed: number) => () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

// --------------------- selector definition DSL ---------------------
// A graph node reference: ["a", i] = atom i, ["s", i] = selector i.
type Ref = ["a", number] | ["s", number]
type Def = {
    ctrl: Ref
    mode: number
    branchA: Ref[] // deps read when ctrl is even
    branchB: Ref[] // deps read when ctrl is odd  (DIFFERENT set => edge churn)
    dyn?: number[] // selector indices; read options[ctrl % len] (dynamic dep)
}

// THE single source of truth for a selector's value. Shared verbatim between
// the valdres selector body and the recompute oracle, so they cannot diverge
// by transcription. `get` maps a Ref to its value.
const compute = (def: Def, get: (r: Ref) => number): number => {
    const ctrlVal = get(def.ctrl) | 0
    let acc = (def.mode + (((ctrlVal % 3) + 3) % 3)) | 0
    const branch = ctrlVal % 2 === 0 ? def.branchA : def.branchB
    for (const r of branch) acc = (acc + (get(r) | 0)) | 0
    if (def.dyn && def.dyn.length > 0) {
        const idx = def.dyn[(((ctrlVal % def.dyn.length) + def.dyn.length) % def.dyn.length)]
        acc = (acc + ((get(["s", idx]) | 0) * 2)) | 0
    }
    return acc | 0
}

// ------------------------- graph generation -------------------------
const buildGraph = (rnd: () => number, nAtoms: number, nSelectors: number, allowCycles: boolean) => {
    const defs: Def[] = []
    const pickAtom = (): Ref => ["a", Math.floor(rnd() * nAtoms)]
    for (let i = 0; i < nSelectors; i++) {
        // CONDITIONAL CYCLES: in cycle mode the graph must still be subscribable
        // from the all-zero initial state (an unconditional cycle just throws at
        // subscribe time — the engine correctly detecting a cycle, not a
        // soundness question). So: ctrl is always an atom (initial value 0 =>
        // even => branchA), branchA / dyn / ctrl stay acyclic (sel < i), but
        // branchB MAY close a cycle (sel in [0, nSelectors)). A cycle therefore
        // only forms mid-propagation once an atom drives a control odd. This is
        // exactly the consuming-app shape (a dynamic dep that conditionally
        // closes a cycle) and is what stresses the stranded while-loop.
        const acyclicUpper = i
        const branchBUpper = allowCycles ? nSelectors : i
        const pickRef = (selUpper: number): Ref =>
            selUpper > 0 && rnd() < 0.5 ? ["s", Math.floor(rnd() * selUpper)] : pickAtom()
        const pickRefs = (n: number, selUpper: number): Ref[] =>
            Array.from({ length: n }, () => pickRef(selUpper))
        const ctrl: Ref = allowCycles
            ? pickAtom()
            : acyclicUpper > 0 && rnd() < 0.5
              ? ["s", Math.floor(rnd() * acyclicUpper)]
              : pickAtom()
        const dyn =
            acyclicUpper > 0 && rnd() < 0.55
                ? Array.from({ length: 1 + Math.floor(rnd() * 3) }, () => Math.floor(rnd() * acyclicUpper))
                : undefined
        defs.push({
            ctrl,
            mode: Math.floor(rnd() * 3),
            branchA: pickRefs(Math.floor(rnd() * 4), acyclicUpper),
            branchB: pickRefs(Math.floor(rnd() * 4), branchBUpper),
            dyn,
        })
    }
    return { nAtoms, nSelectors, defs, allowCycles }
}

type Graph = ReturnType<typeof buildGraph>

const instantiate = (g: Graph) => {
    const atoms = Array.from({ length: g.nAtoms }, (_, i) => atom(0, { name: `a${i}` }))
    const sels: any[] = []
    g.defs.forEach((def, i) => {
        const body = (get: (s: any) => any) =>
            compute(def, (r: Ref) => (r[0] === "a" ? get(atoms[r[1]]) : get(sels[r[1]])))
        sels.push(selector(body, { name: `s${i}` }))
    })
    return { atoms, sels }
}

// --------------------------- the oracle ---------------------------
const CYCLE = Symbol("cycle")
// Recompute every selector's value from scratch given the resolved atom values
// for a particular store context (root or a scope). Returns get(["s", i]) ->
// value, or throws CYCLE for a cyclic/erroring selector.
const makeRecompute = (g: Graph, atomVal: (i: number) => number) => {
    const memo = new Map<number, number | typeof CYCLE>()
    const visiting = new Set<number>()
    const get = (r: Ref): number => {
        if (r[0] === "a") return atomVal(r[1]) | 0
        const i = r[1]
        if (memo.has(i)) {
            const v = memo.get(i)!
            if (v === CYCLE) throw CYCLE
            return v
        }
        if (visiting.has(i)) {
            memo.set(i, CYCLE)
            throw CYCLE
        }
        visiting.add(i)
        let v: number | typeof CYCLE
        try {
            v = compute(g.defs[i], get)
        } catch (e) {
            visiting.delete(i)
            memo.set(i, CYCLE)
            throw CYCLE
        }
        visiting.delete(i)
        memo.set(i, v)
        return v
    }
    return (i: number): { ok: true; v: number } | { ok: false } => {
        try {
            return { ok: true, v: get(["s", i]) }
        } catch {
            return { ok: false }
        }
    }
}

// ----------------------- structural invariants -----------------------
type Violation = { kind: string; detail: string }

const checkInvariants = (
    data: any,
    atoms: any[],
    sels: any[],
    ctxLabel: string,
    cyclicSels?: Set<any>,
): Violation[] => {
    const v: Violation[] = []
    const allNodes = [...atoms, ...sels]
    const idOf = (n: any) => n.name

    // (1) mutual inverse: D in deps(S) <=> S in dependents(D)
    for (const S of sels) {
        const deps = data.stateDependencies.get(S)
        if (deps) {
            for (const D of deps) {
                const back = data.stateDependents.get(D)
                if (!back || !back.has(S)) {
                    v.push({ kind: "mutual-inverse", detail: `${ctxLabel}: ${idOf(S)} deps on ${idOf(D)} but ${idOf(D)}.dependents missing ${idOf(S)}` })
                }
            }
        }
    }
    for (const X of allNodes) {
        const dependents = data.stateDependents.get(X)
        if (dependents) {
            for (const S of dependents) {
                const fwd = data.stateDependencies.get(S)
                if (!fwd || !fwd.has(X)) {
                    v.push({ kind: "mutual-inverse", detail: `${ctxLabel}: ${idOf(X)}.dependents has ${idOf(S)} but ${idOf(S)}.deps missing ${idOf(X)}` })
                }
            }
        }
    }

    // (2) liveDependentCount accuracy. Recompute the live set independently:
    // live = directly-subscribed nodes + all their transitive dependencies
    // (liveness flows from a live node to the states it reads).
    const hasDirectSubs = (n: any) => {
        const s = data.subscriptions.get(n)
        return !!s && s.size > 0
    }
    const live = new Set<any>()
    const stack: any[] = []
    for (const n of allNodes) if (hasDirectSubs(n)) { live.add(n); stack.push(n) }
    while (stack.length) {
        const cur = stack.pop()
        const deps = data.stateDependencies.get(cur)
        if (deps) for (const d of deps) if (!live.has(d)) { live.add(d); stack.push(d) }
    }
    for (const D of allNodes) {
        const dependents = data.stateDependents.get(D)
        let trueCount = 0
        if (dependents) for (const S of dependents) if (live.has(S)) trueCount++
        const stored = data.liveDependentCount.get(D) ?? 0
        if (stored !== trueCount) {
            v.push({ kind: "liveDependentCount-drift", detail: `${ctxLabel}: ${idOf(D)} stored=${stored} true=${trueCount}` })
        }
    }

    // (3) no live selector has a deleted value — EXCEPT a selector that is
    // currently cyclic (errored), which legitimately has its value deleted.
    for (const S of sels) {
        if (live.has(S) && !data.values.has(S) && !(cyclicSels && cyclicSels.has(S))) {
            v.push({ kind: "live-selector-no-value", detail: `${ctxLabel}: live selector ${idOf(S)} has no value` })
        }
    }

    return v
}

// Compare every PRESENT selector value to the from-scratch recompute. A present
// value of a selector reachable from any change must be fresh (the engine either
// re-evaluates it or orphan-deletes it), so a present-but-wrong value is a bug.
const checkValues = (
    g: Graph,
    data: any,
    sels: any[],
    atomVal: (i: number) => number,
    ctxLabel: string,
): { violations: Violation[]; cyclicSels: Set<any> } => {
    const v: Violation[] = []
    const cyclicSels = new Set<any>()
    const recompute = makeRecompute(g, atomVal)
    for (let i = 0; i < sels.length; i++) {
        const expected = recompute(i)
        if (!expected.ok) {
            // Oracle says this selector is cyclic/erroring for the current atom
            // inputs. "Correct value" is undefined; skip the value comparison and
            // record it so invariant (3) exempts it. (Acyclic mode never hits this.)
            cyclicSels.add(sels[i])
            continue
        }
        if (!data.values.has(sels[i])) continue
        const stored = data.values.get(sels[i])
        if (stored !== expected.v) {
            v.push({ kind: "stale-value", detail: `${ctxLabel}: s${i} stored=${stored} expected=${expected.v}` })
        }
    }
    return { violations: v, cyclicSels }
}

// ------------------------- one fuzz run -------------------------
type Op =
    | { t: "set"; ctx: "r" | "c"; ai: number; val: number }
    | { t: "txn"; sets: { ctx: "r" | "c"; ai: number; val: number }[] }
    | { t: "unset"; ctx: "c"; ai: number }
    | { t: "sub"; ctx: "r" | "c"; si: number }
    | { t: "unsub"; ctx: "r" | "c"; si: number }

type RunResult = { ok: true } | { ok: false; step: number; violations: Violation[]; ops: Op[] }

// Engine-on-a-clean-store oracle (used for cycle mode). Replays ONLY the
// atom-mutation ops into a fresh store with no subscribe churn, then exposes
// get(sel) — a lazy fresh recompute that models cycles EXACTLY as the engine
// does. Comparing the incremental store's stored value to this answers "is the
// incremental engine self-consistent under cycles?" without my pure-recompute
// oracle's independent (and necessarily different) cycle modeling.
const freshReplayOracle = (g: Graph, ops: Op[], upto: number, useScope: boolean) => {
    const { atoms, sels } = instantiate(g)
    const root = store(undefined, { enumerable: true })
    const child: any = useScope ? root.scope("child") : null
    for (let i = 0; i <= upto; i++) {
        const op = ops[i]
        try {
            if (op.t === "set") (op.ctx === "r" ? root : child).set(atoms[op.ai], op.val)
            else if (op.t === "unset") child.unset(atoms[op.ai])
            else if (op.t === "txn") {
                root.txn((t: any) => {
                    for (const s of op.sets) {
                        if (s.ctx === "r") t.set(atoms[s.ai], s.val)
                        else t.scope("child", (st: any) => st.set(atoms[s.ai], s.val))
                    }
                })
            }
        } catch { /* a circular throw here mirrors the engine; ignore */ }
    }
    const get = (data: "r" | "c", i: number): { ok: true; v: number } | { ok: false } => {
        try {
            return { ok: true, v: (data === "r" ? root : child).get(sels[i]) }
        } catch {
            return { ok: false }
        }
    }
    return get
}

const checkValuesFresh = (
    g: Graph,
    data: any,
    sels: any[],
    freshGet: (i: number) => { ok: true; v: number } | { ok: false },
    ctxLabel: string,
): { violations: Violation[]; cyclicSels: Set<any> } => {
    const v: Violation[] = []
    const cyclicSels = new Set<any>()
    for (let i = 0; i < sels.length; i++) {
        const fg = freshGet(i)
        if (!fg.ok) { cyclicSels.add(sels[i]); continue }
        if (!data.values.has(sels[i])) continue
        const stored = data.values.get(sels[i])
        if (stored !== fg.v) {
            v.push({ kind: "stale-value", detail: `${ctxLabel}: s${i} stored=${stored} fresh-get=${fg.v}` })
        }
    }
    return { violations: v, cyclicSels }
}

const runScenario = (g: Graph, ops: Op[], useScope: boolean, checkEveryStep = true): RunResult => {
    const { atoms, sels } = instantiate(g)
    const root = store(undefined, { enumerable: true })
    const child: any = useScope ? root.scope("child") : null

    // logical root atom values (for an atom-corruption cross-check). Atoms are
    // inputs, not the thing under test — so for the SELECTOR oracle we resolve an
    // atom's value by probing the engine's actual committed state (this sidesteps
    // having to model scope shadow-creation rules — e.g. that a same-value
    // `set` short-circuits and creates no shadow, while a txn set does). The
    // selector comparison is still a true soundness check: "given the actual
    // committed atom inputs, are the stored selector values what a from-scratch
    // recompute produces?"
    const rootVals = new Array(g.nAtoms).fill(0)
    const engineAtomVal = (data: any, i: number): number => {
        if (data.values.has(atoms[i])) return data.values.get(atoms[i]) | 0
        if (data.parent) return engineAtomVal(data.parent, i)
        return 0 // default
    }
    const rootAtomVal = (i: number) => engineAtomVal(root.data, i)
    const scopeAtomVal = (i: number) => engineAtomVal(child.data, i)

    // track subscriptions so we can probe liveness
    const rootSubs: (null | (() => void))[] = new Array(g.nSelectors).fill(null)
    const childSubs: (null | (() => void))[] = new Array(g.nSelectors).fill(null)

    const applySet = (ctx: "r" | "c", ai: number, val: number) => {
        if (ctx === "r") rootVals[ai] = val
    }

    const verify = (step: number): Violation[] => {
        const out: Violation[] = []
        // atom-corruption cross-check on root (selector propagation must never
        // alter a root atom's stored value).
        for (let i = 0; i < g.nAtoms; i++) {
            if (root.data.values.has(atoms[i]) && (root.data.values.get(atoms[i]) | 0) !== rootVals[i]) {
                out.push({ kind: "atom-corruption", detail: `root: a${i} stored=${root.data.values.get(atoms[i])} expected=${rootVals[i]}` })
            }
        }
        // Acyclic: independent from-scratch recompute (strongest, engine-free).
        // Cycle mode: the engine-on-a-clean-store oracle, which models transient
        // cycles exactly as the engine does — so a divergence is a REAL
        // incremental staleness, not a pure-oracle modeling difference.
        const freshGet = g.allowCycles ? freshReplayOracle(g, ops, step, useScope) : null
        const rv = freshGet
            ? checkValuesFresh(g, root.data, sels, i => freshGet("r", i), "root")
            : checkValues(g, root.data, sels, rootAtomVal, "root")
        out.push(...rv.violations)
        out.push(...checkInvariants(root.data, atoms, sels, "root", rv.cyclicSels))
        if (useScope) {
            const sv = freshGet
                ? checkValuesFresh(g, child.data, sels, i => freshGet("c", i), "scope")
                : checkValues(g, child.data, sels, scopeAtomVal, "scope")
            out.push(...sv.violations)
            out.push(...checkInvariants(child.data, atoms, sels, "scope", sv.cyclicSels))
        }
        return out
    }

    for (let step = 0; step < ops.length; step++) {
        const op = ops[step]
        try {
            switch (op.t) {
                case "set":
                    applySet(op.ctx, op.ai, op.val)
                    if (op.ctx === "r") root.set(atoms[op.ai], op.val)
                    else child.set(atoms[op.ai], op.val)
                    break
                case "txn":
                    for (const s of op.sets) applySet(s.ctx, s.ai, s.val)
                    root.txn((t: any) => {
                        for (const s of op.sets) {
                            if (s.ctx === "r") t.set(atoms[s.ai], s.val)
                            else t.scope("child", (st: any) => st.set(atoms[s.ai], s.val))
                        }
                    })
                    break
                case "unset":
                    child.unset(atoms[op.ai])
                    break
                case "sub": {
                    const arr = op.ctx === "r" ? rootSubs : childSubs
                    const st = op.ctx === "r" ? root : child
                    if (!arr[op.si]) arr[op.si] = st.sub(sels[op.si], () => {})
                    break
                }
                case "unsub": {
                    const arr = op.ctx === "r" ? rootSubs : childSubs
                    if (arr[op.si]) { arr[op.si]!(); arr[op.si] = null }
                    break
                }
            }
        } catch (e) {
            const msg = (e as Error)?.message ?? String(e)
            // A circular-dependency throw from subscribing to / reading a
            // selector that is CURRENTLY cyclic is the engine correctly detecting
            // a cycle, not a soundness failure. Tolerate it, but still run the
            // structural-invariant checks below to confirm the throw left the
            // graph uncorrupted (no leaked circularDepSet entry, no dep drift).
            if (!/[Cc]ircular/.test(msg)) {
                return { ok: false, step, violations: [{ kind: "throw", detail: `op ${op.t} threw: ${msg}` }], ops }
            }
        }

        if (checkEveryStep) {
            const viols = verify(step)
            if (viols.length) return { ok: false, step, violations: viols, ops }
        }
    }
    // final check regardless
    const viols = verify(ops.length - 1)
    // cleanup
    rootSubs.forEach(u => u && u())
    childSubs.forEach(u => u && u())
    if (viols.length) return { ok: false, step: ops.length - 1, violations: viols, ops }
    return { ok: true }
}

// ------------------------- op-sequence generation -------------------------
const genOps = (rnd: () => number, g: Graph, useScope: boolean): Op[] => {
    const ops: Op[] = []
    const ctxPick = (): "r" | "c" => (useScope && rnd() < 0.5 ? "c" : "r")
    // initial subscriptions
    for (let si = 0; si < g.nSelectors; si++) {
        if (rnd() < 0.55) ops.push({ t: "sub", ctx: "r", si })
        if (useScope && rnd() < 0.4) ops.push({ t: "sub", ctx: "c", si })
    }
    // initial scope shadows
    if (useScope) {
        for (let ai = 0; ai < g.nAtoms; ai++) {
            if (rnd() < 0.35) ops.push({ t: "set", ctx: "c", ai, val: Math.floor(rnd() * 6) })
        }
    }
    const steps = 40 + Math.floor(rnd() * 30)
    for (let s = 0; s < steps; s++) {
        const roll = rnd()
        // subscribe churn
        const churn = Math.floor(rnd() * 3)
        for (let c = 0; c < churn; c++) {
            const si = Math.floor(rnd() * g.nSelectors)
            const ctx: "r" | "c" = useScope && rnd() < 0.5 ? "c" : "r"
            ops.push({ t: rnd() < 0.5 ? "sub" : "unsub", ctx, si })
        }
        if (roll < 0.45) {
            ops.push({ t: "set", ctx: ctxPick(), ai: Math.floor(rnd() * g.nAtoms), val: Math.floor(rnd() * 6) })
        } else if (roll < 0.85) {
            const n = 1 + Math.floor(rnd() * 4)
            const sets = Array.from({ length: n }, () => ({ ctx: ctxPick(), ai: Math.floor(rnd() * g.nAtoms), val: Math.floor(rnd() * 6) }))
            ops.push({ t: "txn", sets })
        } else if (useScope) {
            ops.push({ t: "unset", ctx: "c", ai: Math.floor(rnd() * g.nAtoms) })
        } else {
            ops.push({ t: "set", ctx: "r", ai: Math.floor(rnd() * g.nAtoms), val: Math.floor(rnd() * 6) })
        }
    }
    return ops
}

// ------------------------------- shrinking -------------------------------
const shrink = (g: Graph, ops: Op[], useScope: boolean): { g: Graph; ops: Op[] } => {
    let curOps = ops
    // 1. truncate to the failing step
    let r = runScenario(g, curOps, useScope)
    if (r.ok) return { g, ops }
    curOps = curOps.slice(0, (r as any).step + 1)

    // 2. greedily drop ops while still failing
    let changed = true
    while (changed) {
        changed = false
        for (let i = 0; i < curOps.length; i++) {
            const trial = curOps.slice(0, i).concat(curOps.slice(i + 1))
            if (trial.length === 0) continue
            const rr = runScenario(g, trial, useScope)
            if (!rr.ok) { curOps = trial; changed = true; break }
        }
    }
    return { g, ops: curOps }
}

// --------------------------------- main ---------------------------------
const maxSeed = Number(process.argv[2] ?? 3000)
const allowCyclesFrom = Number(process.argv[3] ?? Infinity) // seed >= this -> cycle mode
let failures = 0
const t0 = Date.now()
for (let seed = 1; seed <= maxSeed; seed++) {
    const rnd = mulberry32(seed * 2654435761)
    const nAtoms = 3 + Math.floor(rnd() * 5)
    const nSelectors = 8 + Math.floor(rnd() * 16)
    const allowCycles = seed >= allowCyclesFrom
    const g = buildGraph(rnd, nAtoms, nSelectors, allowCycles)
    const useScope = rnd() < 0.6
    const ops = genOps(rnd, g, useScope)
    let r: RunResult
    try {
        r = runScenario(g, ops, useScope)
    } catch (e) {
        r = { ok: false, step: -1, violations: [{ kind: "harness-throw", detail: String(e) }], ops }
    }
    if (!r.ok) {
        failures++
        console.log(`\n❌ SEED ${seed} FAILED at step ${(r as any).step} (cycles=${allowCycles}, scope=${useScope})`)
        for (const viol of (r as any).violations.slice(0, 6)) {
            console.log(`   [${viol.kind}] ${viol.detail}`)
        }
        if (!allowCycles) {
            const sh = shrink(g, ops, useScope)
            console.log(`   shrunk: ${sh.ops.length} ops`)
            // print the shrunk reproducer
            const re = runScenario(sh.g, sh.ops, useScope)
            if (!re.ok) {
                console.log(`   GRAPH: ${JSON.stringify(sh.g)}`)
                console.log(`   OPS:   ${JSON.stringify(sh.ops)}`)
                console.log(`   useScope=${useScope}`)
                for (const viol of (re as any).violations.slice(0, 6)) console.log(`   -> [${viol.kind}] ${viol.detail}`)
            }
        }
        if (failures >= 5) { console.log("\nstopping after 5 failures"); break }
    }
}
const dt = Date.now() - t0
console.log(`\nDone: ${maxSeed} seeds, ${failures} failures, ${dt}ms`)
