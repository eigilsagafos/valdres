import { expect, test } from "bun:test"
import { atom } from "../atom"
import { selector } from "../selector"
import { store } from "../store"

// Differential fuzzer for the cycle-gated liveness reconcile. Selectors read ANY
// other selector (CYCLES allowed), with a parity-gated branch so only one of two
// dependency sets is live at a time — so the dependency GRAPH contains cycles even
// though no single evaluation recurses. That is exactly the shape the cycle-gating
// theorem rests on (freeze/leak require a cycle in the region), so this is the
// safety net for it: it asserts the incrementally-maintained `liveDependentCount`
// equals ground-truth reachability after every churn, across thousands of ops.
//
// IMPORTANT: this test must FAIL if the invariant breaks — see the assertions at
// the end. (It previously only console.error'd the tallies and passed regardless.)
//
// SCOPE: synchronous churn only (txn atom-sets + sub/unsub). Async-selector
// dependency churn through a cycle is NOT exercised here — the async resolve path
// (handleSelectorResult) settles liveness incrementally and is unchanged by this
// work; cyclic async churn is a known, separate, least-exercised corner.

type Mismatch = { dir: "UNDER" | "OVER"; msg: string }

let uid = 0

// Seeded PRNG (mulberry32) — deterministic so a failure is reproducible by seed.
const mulberry32 = (seed: number) => () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

// Ground truth: recompute each state's live-dependent count from reachability and
// compare to the store's incrementally-maintained `liveDependentCount`. Returns the
// first mismatch (UNDER = freeze-class undercount, OVER = leak-class overcount), or
// null if every count matches.
const check = (s: any, states: any[]): Mismatch | null => {
    const data = s.data

    // 1. Live set = directly-subscribed states, then fixpoint-propagated down
    //    through dependencies (a live state's deps are live).
    const live = new Set<any>()
    for (const st of states) {
        if ((data.subscriptions.get(st)?.size ?? 0) > 0) live.add(st)
    }
    let changed = true
    while (changed) {
        changed = false
        for (const T of states) {
            if (!live.has(T)) continue
            const deps = data.stateDependencies.get(T)
            if (!deps) continue
            for (const D of deps) {
                if (states.includes(D) && !live.has(D)) {
                    live.add(D)
                    changed = true
                }
            }
        }
    }

    // 2. Expected count[D] = number of LIVE states that depend on D.
    const expected = new Map<any, number>()
    for (const T of states) {
        if (!live.has(T)) continue
        const deps = data.stateDependencies.get(T)
        if (!deps) continue
        for (const D of deps) expected.set(D, (expected.get(D) ?? 0) + 1)
    }

    // 3. Compare against the maintained count.
    for (const D of states) {
        const exp = expected.get(D) ?? 0
        const got = data.liveDependentCount.get(D) ?? 0
        if (got !== exp) {
            return {
                dir: got < exp ? "UNDER" : "OVER",
                msg: `${String(D.name).slice(0, 30)} exp ${exp} got ${got}`,
            }
        }
    }
    return null
}

// 8000 seeds (vs ~400 in the acyclic fuzzers) because this one ALLOWS cycles:
// ~90% of random configs hit a genuine eval-time circular dependency and are
// skipped (see the catch below), so 8000 seeds yield ~15.6k surviving churn ops —
// comparable coverage to the acyclic fuzzers, which skip nothing. It is fully
// deterministic (seeded PRNG, synchronous) so it can't be flaky, and runs in
// ~0.4s; the explicit timeout is a generous bound against a future hang, not a
// budget it approaches.
test("cyclic dynamic-dep liveness invariant holds across churn", () => {
    let under = 0
    let over = 0
    let ran = 0
    let firstUnder = ""
    let firstOver = ""

    for (let seed = 1; seed <= 8000; seed++) {
        const rnd = mulberry32(seed)
        const run = ++uid
        const nA = 3 + Math.floor(rnd() * 3)
        const nS = 5 + Math.floor(rnd() * 7)

        const atoms = Array.from({ length: nA }, (_, i) =>
            atom(Math.floor(rnd() * 4), { name: `cy_a${i}.${run}` }),
        )
        // Each selector reads a base atom + (parity-gated) ANY other selectors —
        // the A/B branches form graph cycles that no single eval traverses.
        const defs = Array.from({ length: nS }, () => ({
            g0: Math.floor(rnd() * nA),
            g1: Math.floor(rnd() * nA),
            A: Array.from({ length: 1 + Math.floor(rnd() * 2) }, () =>
                Math.floor(rnd() * nS),
            ),
            B: Array.from({ length: 1 + Math.floor(rnd() * 2) }, () =>
                Math.floor(rnd() * nS),
            ),
            aa: Math.floor(rnd() * nA),
        }))
        const sels: any[] = []
        for (let i = 0; i < nS; i++) {
            const def = defs[i]!
            sels.push(
                selector(
                    (get: any) => {
                        let acc = get(atoms[def.aa])
                        if ((get(atoms[def.g0]) + get(atoms[def.g1])) % 2 === 0) {
                            for (const j of def.A) if (j !== i) acc += get(sels[j])
                        } else {
                            for (const j of def.B) if (j !== i) acc += get(sels[j]) * 2
                        }
                        return acc % 97
                    },
                    { name: `cy_s${i}.${run}` },
                ),
            )
        }

        const states = [...atoms, ...sels]
        const root = store("cy_gs" + run)
        // Exercise both the root store and a scope (different liveness owners).
        const ctx = rnd() < 0.5 ? root.scope("d") : root

        const subs = new Map<number, () => void>()
        const toggle = (si: number) => {
            if (subs.has(si)) {
                subs.get(si)!()
                subs.delete(si)
            } else {
                subs.set(si, ctx.sub(sels[si], () => {}, false))
            }
        }

        const record = (where: string) => {
            const bad = check(ctx, states)
            if (!bad) return
            if (bad.dir === "UNDER") {
                under++
                if (!firstUnder) firstUnder = `seed=${seed} ${where} ${bad.msg}`
            } else {
                over++
                if (!firstOver) firstOver = `seed=${seed} ${where} ${bad.msg}`
            }
        }

        try {
            for (let si = 0; si < nS; si++) if (rnd() < 0.4) toggle(si)
            record("init")
            for (let step = 0; step < 20; step++) {
                const w = 1 + Math.floor(rnd() * nA)
                ctx.txn((t: any) => {
                    for (let k = 0; k < w; k++) {
                        t.set(atoms[Math.floor(rnd() * nA)], Math.floor(rnd() * 4))
                    }
                })
                if (rnd() < 0.5) toggle(Math.floor(rnd() * nS))
                ran++
                record(`step=${step}`)
            }
            for (const u of subs.values()) u()
        } catch {
            // A randomly-generated config can hit a genuine eval-time circular
            // dependency (SelectorCircularDependencyError); those seeds are not
            // the invariant under test, so skip them.
        }
    }

    // Non-vacuity: the suite normally exercises ~15k churn ops; guard against a
    // future change that makes every seed throw and the test pass trivially.
    expect(ran).toBeGreaterThan(5000)
    // The invariant: no undercount (freeze) and no overcount (leak), ever. These
    // hold the first offending `seed=… step=… <state> exp … got …` as the message,
    // so a failure is reproducible; "" means the tally was 0.
    expect(firstUnder).toBe("")
    expect(firstOver).toBe("")
    expect(under).toBe(0)
    expect(over).toBe(0)
}, 30000)
