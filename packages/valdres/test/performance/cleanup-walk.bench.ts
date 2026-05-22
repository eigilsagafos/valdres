import { describe, test, expect } from "./test-compat"
import { atom as valdresAtom } from "../../src/atom"
import { selector as valdresSelector } from "../../src/selector"
import { store as valdresCreateStore } from "../../src/store"

// Manual bench: cleanupOrphanedDeps walking a deep dependent chain.
// Each iteration rebuilds the chain because cleanup destroys it on unsub.
//
// Topology:
//   base (atom)  ←  S1  ←  S2  ←  ...  ←  S_N    (each S_i reads S_{i-1})
//
// We subscribe to base, then unsubscribe. Cleanup walks UP through the
// chain: for each S_i it calls isTransitivelySubscribed, which (in main)
// walks the remaining N-i upper nodes. Total: O(N²).
//
// With the cached isLive flag, each check is O(1) → total cleanup O(N).

const NS = [100, 200, 500, 1000]

const buildChain = (N: number) => {
    const store = valdresCreateStore()
    const base = valdresAtom(0, { name: "base" })
    const chain: any[] = [base]
    for (let i = 1; i <= N; i++) {
        const dep = chain[i - 1]
        chain.push(valdresSelector(get => get(dep) + 1, { name: `S-${i}` }))
    }
    for (const s of chain) store.get(s)
    return { store, base }
}

const median = (xs: number[]) => {
    const sorted = [...xs].sort((a, b) => a - b)
    return sorted[Math.floor(sorted.length / 2)]
}

const fmt = (ns: number) =>
    ns < 1_000 ? `${ns.toFixed(0)}ns` :
    ns < 1_000_000 ? `${(ns / 1_000).toFixed(2)}µs` :
    `${(ns / 1_000_000).toFixed(2)}ms`

describe("cleanup-walk", () => {
    test("subscribe+unsubscribe on deep dependent chain", () => {
        for (const N of NS) {
            const samples: number[] = []
            // Warmup
            for (let w = 0; w < 5; w++) {
                const { store, base } = buildChain(N)
                const u = store.sub(base, () => {})
                u()
            }
            // Measure
            const ITERS = 30
            for (let i = 0; i < ITERS; i++) {
                const { store, base } = buildChain(N)
                const t0 = Bun.nanoseconds()
                const u = store.sub(base, () => {})
                u()
                const t1 = Bun.nanoseconds()
                samples.push(t1 - t0)
            }
            const m = median(samples)
            const min = Math.min(...samples)
            console.log(`N=${String(N).padStart(4)}: median=${fmt(m).padStart(10)}  min=${fmt(min).padStart(10)}`)
        }
        expect(true).toBe(true)
    })
})
