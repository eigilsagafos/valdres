import { describe, expect, test } from "bun:test"
import { atom } from "../atom"
import { selector } from "../selector"
import { store } from "../store"

// Serializable observation: a transaction is atomic, so every observation point
// (any subscriber fire, any read from within a subscriber callback) must see
// the fully-applied final state — never a half-settled intermediate. The
// per-store guard fix makes the FINAL STORED values correct, but a subscriber
// for a selector evaluated early in one pass and recomputed in a later pass
// still fires once with the stale intermediate and once with the final value.
// These tests pin the stronger guarantee (fire only the final value); they are
// expected to FAIL until notification is deferred to commit-end.

const mulberry32 = (seed: number) => () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

describe("serializable observation", () => {
    test("cross-scope subscriber never observes a stale intermediate", () => {
        const R = atom(1, { name: "ser-R" })
        const A = atom(10, { name: "ser-A" })
        const N = selector(get => get(A) * 1000, { name: "ser-N" })
        const M = selector(get => get(R) + get(N), { name: "ser-M" })
        const root = store()
        const S = root.scope("S")
        S.set(A, 10)
        S.sub(N, () => {})
        const observed: number[] = []
        S.sub(M, () => observed.push(S.get(M)))
        expect(S.get(M)).toBe(10001)

        root.txn(t => {
            t.set(R, 2)
            t.scope("S", st => st.set(A, 20))
        })

        // Atomic: the only value ever observed is the final one.
        expect(observed).toEqual([20002])
    })

    test("a subscriber that reads a sibling selector sees a consistent snapshot", () => {
        // M and a sibling P both derive from the same inputs. When M's
        // subscriber fires, reading P must give a value consistent with the M
        // it was notified about — i.e. both reflect the same committed state.
        const R = atom(1, { name: "ser2-R" })
        const A = atom(10, { name: "ser2-A" })
        const N = selector(get => get(A) * 1000, { name: "ser2-N" })
        const M = selector(get => get(R) + get(N), { name: "ser2-M" })
        const P = selector(get => get(N) - get(R), { name: "ser2-P" })
        const root = store()
        const S = root.scope("S")
        S.set(A, 10)
        S.sub(N, () => {})
        S.sub(P, () => {})
        const snapshots: Array<{ m: number; p: number }> = []
        S.sub(M, () => snapshots.push({ m: S.get(M), p: S.get(P) }))
        S.get(M)

        root.txn(t => {
            t.set(R, 2)
            t.scope("S", st => st.set(A, 20))
        })

        // Every observed (M, P) pair must satisfy the invariant M + P === 2*N,
        // i.e. both read from one committed atom-state. A stale M with a fresh P
        // (or vice versa) breaks it.
        for (const { m, p } of snapshots) {
            expect(m + p).toBe(2 * S.get(N))
        }
    })

    test("fuzz: cross-scope subscribers only ever observe final values", () => {
        for (let seed = 1; seed <= 200; seed++) {
            const rnd = mulberry32(seed)
            const R = atom(1, { name: "f-R" })
            const A = atom(1, { name: "f-A" })
            const B = atom(1, { name: "f-B" })
            const n1 = selector(get => get(A) * 10, { name: "f-n1" })
            const n2 = selector(get => get(B) + get(n1), { name: "f-n2" })
            const m = selector(get => get(R) + get(n1) + get(n2), { name: "f-m" })
            const root = store()
            const S = root.scope("S")
            S.set(A, 1)
            S.set(B, 1)
            const fired: Record<string, number[]> = { n1: [], n2: [], m: [] }
            S.sub(n1, () => fired.n1.push(S.get(n1)))
            S.sub(n2, () => fired.n2.push(S.get(n2)))
            S.sub(m, () => fired.m.push(S.get(m)))
            // warm
            S.get(m)

            const steps = 1 + Math.floor(rnd() * 4)
            for (let s = 0; s < steps; s++) {
                for (const k of Object.keys(fired)) fired[k].length = 0
                root.txn(t => {
                    if (rnd() < 0.7) t.set(R, Math.floor(rnd() * 20))
                    t.scope("S", st => {
                        if (rnd() < 0.7) st.set(A, Math.floor(rnd() * 20))
                        if (rnd() < 0.7) st.set(B, Math.floor(rnd() * 20))
                    })
                })
                const finalN1 = S.get(n1)
                const finalN2 = S.get(n2)
                const finalM = S.get(m)
                for (const v of fired.n1) expect(v).toBe(finalN1)
                for (const v of fired.n2) expect(v).toBe(finalN2)
                for (const v of fired.m) expect(v).toBe(finalM)
            }
        }
    })
})
