/**
 * Measures the effect of the two cross-cutting perf changes on plain
 * atomFamily writes (no atomFamilyIndex / Search / Sort registered) —
 * the path every valdres user hits, not just search consumers.
 *
 *   bun run packages/valdres/test/performance/familyWrite.compare.ts
 *
 * Reports three regimes:
 *   - `txn`: bulk set inside `store.txn(...)`. Exercises the lazy family
 *     re-render in transaction.ts.
 *   - `no-txn`: per-call `store.set`. Exercises the skip-sort fast path
 *     in `renderAtomFamilyIndex`.
 *   - `read`: warm read of `store.get(family)` after bulk insert. Confirms
 *     no read-path regression from the lazy render.
 */

import { atomFamily } from "../../src/atomFamily"
import { store } from "../../src/store"

const fmt = (ms: number) =>
    ms < 1 ? `${(ms * 1000).toFixed(0)}µs` : `${ms.toFixed(2)}ms`

const time = async (
    label: string,
    iter: number,
    fn: () => void,
): Promise<number> => {
    fn() // warmup
    if (typeof Bun !== "undefined") Bun.gc(true)
    const samples: number[] = []
    for (let i = 0; i < iter; i++) {
        if (typeof Bun !== "undefined") Bun.gc(true)
        const t0 = performance.now()
        fn()
        samples.push(performance.now() - t0)
    }
    samples.sort((a, b) => a - b)
    const median = samples[Math.floor(samples.length / 2)]
    console.log(`  ${label.padEnd(38)} ${fmt(median).padStart(10)}`)
    return median
}

type Doc = { id: number; name: string; payload: string }

const makeDocs = (n: number): Doc[] => {
    const out: Doc[] = []
    for (let i = 0; i < n; i++) {
        out.push({
            id: i,
            name: `name-${i}`,
            payload: `payload-${i}-data-data-data`,
        })
    }
    return out
}

const runForSize = async (n: number, iter: number) => {
    const docs = makeDocs(n)
    console.log(`\n━━ plain atomFamily writes — N=${n.toLocaleString()}, iter=${iter} ━━`)

    await time("txn: bulk set", iter, () => {
        const s = store()
        const doc = atomFamily<Doc, [number]>(null, { name: "doc" })
        s.txn(({ set }) => {
            for (const d of docs) set(doc(d.id), d)
        })
    })

    await time("no-txn: per-call set", iter, () => {
        const s = store()
        const doc = atomFamily<Doc, [number]>(null, { name: "doc" })
        for (const d of docs) s.set(doc(d.id), d)
    })

    // Warm read of family list: confirms the lazy render doesn't punish
    // the read path. We pre-build, then time `store.get(family)`.
    const built = (() => {
        const s = store()
        const doc = atomFamily<Doc, [number]>(null, { name: "doc" })
        s.txn(({ set }) => {
            for (const d of docs) set(doc(d.id), d)
        })
        return { s, doc }
    })()
    await time("warm read: store.get(family)", iter * 10, () => {
        const arr = built.s.get(built.doc as any)
        if (!arr) throw new Error("unexpected")
    })

    // Single-atom write into existing family (a really common pattern)
    const populated = (() => {
        const s = store()
        const doc = atomFamily<Doc, [number]>(null, { name: "doc" })
        s.txn(({ set }) => {
            for (const d of docs) set(doc(d.id), d)
        })
        return { s, doc }
    })()
    let writeCounter = 0
    await time("single set into populated family", iter * 100, () => {
        const i = writeCounter++ % n
        populated.s.set(populated.doc(i), {
            id: i,
            name: `name-${i}-v${writeCounter}`,
            payload: `payload-${i}`,
        })
    })
}

const main = async () => {
    console.log(`runtime: ${typeof Bun !== "undefined" ? `bun ${Bun.version}` : `node ${process.version}`}`)
    for (const n of [1_000, 10_000]) await runForSize(n, 8)
}

main()
