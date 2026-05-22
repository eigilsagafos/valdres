/**
 * State-propagation benchmark. Each scenario isolates one suspected hot
 * path on the subscribed-selector update path: plain fan-out, dep churn,
 * structured family args, and a "load entity" integration shape.
 *
 *     bun packages/valdres/test/performance/propagation.bench.ts
 *
 * Numbers are absolute per-op timings (median, IQR-trimmed). To compare
 * against a previous tag, run the same file with that tag's source checked
 * out and diff the printed values.
 */

import { atom } from "../../src/atom"
import { atomFamily } from "../../src/atomFamily"
import { selector } from "../../src/selector"
import { selectorFamily } from "../../src/selectorFamily"
import { store as createStore } from "../../src/store"

const now: () => number =
    typeof Bun !== "undefined" && typeof Bun.nanoseconds === "function"
        ? Bun.nanoseconds
        : () => Math.ceil(1e6 * performance.now())

interface SampleResult {
    name: string
    median: number
    p10: number
    p90: number
    n: number
}

const results: SampleResult[] = []

function measure(name: string, setup: () => () => void, opts?: { batchSize?: number; samples?: number; warmup?: number }) {
    const batchSize = opts?.batchSize ?? 100
    const samples = opts?.samples ?? 200
    const warmup = opts?.warmup ?? 20

    const run = setup()
    for (let i = 0; i < warmup; i++) run()

    const times = new Array<number>(samples)
    for (let s = 0; s < samples; s++) {
        const t0 = now()
        for (let i = 0; i < batchSize; i++) run()
        const t1 = now()
        times[s] = (t1 - t0) / batchSize
    }
    times.sort((a, b) => a - b)
    const median = times[Math.floor(samples / 2)]!
    const p10 = times[Math.floor(samples * 0.1)]!
    const p90 = times[Math.floor(samples * 0.9)]!
    results.push({ name, median, p10, p90, n: samples })
    console.log(
        `  ${name.padEnd(48)} ${fmtNs(median).padStart(10)}  (p10 ${fmtNs(p10)} / p90 ${fmtNs(p90)})`,
    )
}

function fmtNs(ns: number): string {
    if (ns < 1_000) return `${ns.toFixed(0)}ns`
    if (ns < 1_000_000) return `${(ns / 1_000).toFixed(2)}µs`
    return `${(ns / 1_000_000).toFixed(3)}ms`
}

// ─── Scenario 1: control — fan-out of plain selectors over one atom ────────
// Sets the baseline cost of a propagation that triggers N re-evaluations
// with NO dep churn (every selector reads the same single atom every time).
// Hotspots: `updateStateInner`, `evaluateSelector`, `getState`.
{
    console.log("\nFan-out from one atom (no dep churn)")
    for (const n of [10, 100, 500]) {
        measure(`set + recompute ${n} subscribers`, () => {
            const s = createStore()
            const a = atom(0)
            const sels = Array.from({ length: n }, (_, i) =>
                selector(get => get(a) + i),
            )
            // subscribe so the selectors stay live + the propagation runs them
            const noop = () => {}
            for (const sel of sels) s.sub(sel, noop)
            let v = 0
            return () => {
                s.set(a, ++v)
            }
        })
    }
}

// ─── Scenario 2: dep churn on every update ──────────────────────────────────
// Each selector picks one of two atoms based on a "toggle" atom — so on every
// toggle, every selector swaps which atom it reads. This forces the
// `mountTransitiveDeps` / `unmountOrphanedDeps` walks on the propagation path.
// Hotspots: `mountTransitiveDeps`, `unmountOrphanedDeps`, `isTransitivelySubscribed`.
{
    console.log("\nDep churn (selectors swap dep on each update)")
    for (const n of [10, 100, 500]) {
        measure(`toggle dep across ${n} subscribers`, () => {
            const s = createStore()
            const toggle = atom(true)
            const a = atom(1)
            const b = atom(2)
            const sels = Array.from({ length: n }, () =>
                selector(get => (get(toggle) ? get(a) : get(b))),
            )
            const noop = () => {}
            for (const sel of sels) s.sub(sel, noop)
            let v = true
            return () => {
                v = !v
                s.set(toggle, v)
            }
        })
    }
}

// ─── Scenario 3: selectorFamily with structured args ───────────────────────
// Each selector is keyed by a structured object → engages
// `stableStringifyRecurse` at family-key time. Re-reading the family with
// the SAME structured arg should ideally not re-stringify on the hot path.
// Hotspots: `stableStringifyRecurse`, `familyKey`.
{
    console.log("\nselectorFamily with structured args")
    const a = atom(0)
    const fam = selectorFamily(
        (key: { id: string; field: string }) => get =>
            `${key.id}:${key.field}:${get(a)}`,
    )
    const s = createStore()
    const args = Array.from({ length: 100 }, (_, i) => ({
        id: `e-${i}`,
        field: i % 2 ? "name" : "status",
    }))
    // Pre-init each family selector once
    for (const arg of args) s.get(fam(arg))

    measure("100x family-lookup (cached, structured args)", () => () => {
        for (const arg of args) s.get(fam(arg))
    })
}

// ─── Scenario 4: "load entity" integration shape ──────────────────────────
// Models a typical app pattern: one "activeId" atom selects which entity is
// shown, an atomFamily holds per-entity data, and many subscribed selectors
// derive views from the active entity. The update = switching activeId,
// which causes most derived selectors to re-evaluate with churned deps.
// Hotspots: all of them. This is the integration repro.
{
    console.log("\n\"Load entity\" integration shape")
    for (const n of [50, 200]) {
        measure(`activate entity — ${n} derived selectors subscribed`, () => {
            const s = createStore()
            const activeId = atom<string | null>(null)
            const entityData = atomFamily((_id: string) => ({
                nodes: Array.from({ length: 20 }, (_, i) => ({
                    id: `n${i}`,
                    label: `Node ${i}`,
                })),
            }))
            // Mixed selector population: half plain, half selectorFamily with
            // structured args (so we engage stableStringify too).
            const plainSelectors = Array.from({ length: n >> 1 }, (_, i) =>
                selector(get => {
                    const id = get(activeId)
                    if (!id) return null
                    const data = get(entityData(id))
                    return data.nodes[i % data.nodes.length]
                }),
            )
            const famSelector = selectorFamily(
                (key: { idx: number; mode: "label" | "id" }) => get => {
                    const id = get(activeId)
                    if (!id) return null
                    const data = get(entityData(id))
                    const node = data.nodes[key.idx % data.nodes.length]!
                    return key.mode === "label" ? node.label : node.id
                },
            )
            const famArgs = Array.from({ length: n - (n >> 1) }, (_, i) => ({
                idx: i,
                mode: (i % 2 ? "label" : "id") as "label" | "id",
            }))
            const famSelectors = famArgs.map(a => famSelector(a))
            const all = [...plainSelectors, ...famSelectors]
            const noop = () => {}
            for (const sel of all) s.sub(sel, noop)

            let i = 0
            return () => {
                i++
                s.set(activeId, `p${i}`)
            }
        }, { batchSize: 20, samples: 100 })
    }
}

// ─── Summary ───────────────────────────────────────────────────────────────
console.log("\n--- summary (median per op) ---")
for (const r of results) {
    console.log(`  ${r.name.padEnd(48)} ${fmtNs(r.median)}`)
}

// Emit machine-readable NDJSON for diffing across runs.
import { appendFileSync } from "fs"
import { join } from "path"
const outPath = join(import.meta.dir, "propagation.ndjson")
const stamp = new Date().toISOString()
for (const r of results) {
    appendFileSync(outPath, JSON.stringify({ stamp, ...r }) + "\n")
}
console.log(`\nresults appended to ${outPath}`)
