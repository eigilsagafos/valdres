/**
 * State-propagation benchmark. Each scenario isolates one suspected hot
 * path on the subscribed-selector update path: plain fan-out, dep churn,
 * structured family args, and a "load entity" integration shape modeled on
 * a real-world click handler.
 *
 * Run with `bun test:bench` (Bun) or `npm run test:bench:node` (Node/Vitest).
 * Each scenario records an absolute per-op latency (mitata p50, via
 * measureOne); Bencher gates each series against its own history.
 */
import { describe, test } from "./test-compat"
import { measureOne } from "./bench-utils"
import { atom } from "../../src/atom"
import { atomFamily } from "../../src/atomFamily"
import { selector } from "../../src/selector"
import { selectorFamily } from "../../src/selectorFamily"
import { store as createStore } from "../../src/store"

const noop = () => {}

// Reusable pool size for atomFamily ids — large enough to span steady-state
// churn without growing the family map across iterations.
const ID_POOL = 8

describe("propagation: fan-out from one atom (no dep churn)", () => {
    test("set + recompute subscribers", async () => {
        for (const n of [10, 100, 500]) {
            const s = createStore()
            const a = atom(0)
            const sels = Array.from({ length: n }, (_, i) =>
                selector(get => get(a) + i),
            )
            for (const sel of sels) s.sub(sel, noop)
            let v = 0
            await measureOne(`fanout: set + recompute ${n} subs`, () => {
                s.set(a, ++v)
            })
        }
    })
})

describe("propagation: dep churn (selectors swap dep on each update)", () => {
    test("toggle dep across subscribers", async () => {
        for (const n of [10, 100, 500]) {
            const s = createStore()
            const toggle = atom(true)
            const a = atom(1)
            const b = atom(2)
            const sels = Array.from({ length: n }, () =>
                selector(get => (get(toggle) ? get(a) : get(b))),
            )
            for (const sel of sels) s.sub(sel, noop)
            let v = true
            await measureOne(`dep-churn: toggle across ${n} subs`, () => {
                v = !v
                s.set(toggle, v)
            })
        }
    })
})

describe("propagation: selectorFamily with structured args", () => {
    test("100x family-lookup (cached, structured args)", async () => {
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
        for (const arg of args) s.get(fam(arg))

        await measureOne("family-lookup: 100x cached structured args", () => {
            for (const arg of args) s.get(fam(arg))
        })
    })
})

describe("propagation: load-entity integration shape", () => {
    test("activate entity — derived selectors subscribed", async () => {
        for (const n of [50, 200]) {
            const s = createStore()
            const activeId = atom<string | null>(null)
            const entityData = atomFamily((_id: string) => ({
                nodes: Array.from({ length: 20 }, (_, i) => ({
                    id: `n${i}`,
                    label: `Node ${i}`,
                })),
            }))
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
            for (const sel of all) s.sub(sel, noop)

            // Pre-warm the atomFamily with the ids we'll cycle through so the
            // measured op exercises steady-state propagation, not first-init
            // allocation.
            const ids = Array.from({ length: ID_POOL }, (_, i) => `e${i}`)
            for (const id of ids) s.get(entityData(id))

            let i = 0
            await measureOne(
                `load-entity: activate, ${n} derived subs`,
                () => {
                    s.set(activeId, ids[i++ % ID_POOL]!)
                },
            )
        }
    })
})
