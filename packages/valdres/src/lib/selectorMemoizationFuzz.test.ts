import { expect, test } from "bun:test"
import { atom } from "../atom"
import { selector } from "../selector"
import { store } from "../store"
import type { Store } from "../types/Store"
import { measureArchitecture } from "../../test/utils/measureArchitecture"

// Property test over selector memoization. No hand-picked shapes and no oracle
// implementation — the INVARIANT is the oracle:
//
//   P1. A cold read evaluates each REACHABLE node exactly once, never once per
//       `get()`.
//   P2. A read of an already-settled graph evaluates nothing at all.
//   P3. Neither ever throws.
//
// These hold for any acyclic shape, any return value, any comparator, any
// liveness, any store depth. That is the point: selectorMemoizationGate.test.ts
// is a matrix of dimensions someone chose, and a matrix can only cover the
// dimensions and variants its author thought of. Both bugs fixed in this PR
// slipped through exactly there — the second one because the gate's custom-equal
// dimension held a single variant that ignored its own operands.
//
// Validated by construction: against the pre-fix core this fuzzer fails ~70% of
// seeds (350/500), tripping all three properties, and it rediscovers BOTH bugs
// — the lost memoization and the comparator crash — without being told either
// exists. On the fixed core, 20k seeds are clean.
//
// Scope: acyclic on purpose. Counting reachable nodes requires it, and this
// property is about memoization, not liveness — cycles are what liveness
// fuzzing needs (see livenessCyclicFuzz.test.ts).
//
// Deliberately UNNAMED states and stores: named atoms register in the process-
// wide name registry, and thousands of registrations per run would be a needless
// interaction with the leak-detection suites sharing this process.

const mulberry32 = (seed: number) => () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

// A comparator is only paired with values it is contractually allowed to see.
// `EqualFunc<V>` types both operands as `V`, so a comparator that dereferences
// belongs only on a selector whose `V` is always an object. Pairing one with a
// possibly-`undefined` `V` would be the CALLER's contract violation — it would
// throw on the second evaluation legitimately — so the generator keeps the two
// sets apart rather than reporting a false engine bug.
const OBJECT_COMPARATORS: Array<((a: any, b: any) => boolean) | undefined> = [
    undefined,
    () => true,
    (a, b) => a.id === b.id,
    (a, b) => a === b,
    (a, b) => Object.keys(a).length === Object.keys(b).length,
]
const NULLABLE_COMPARATORS: Array<((a: any, b: any) => boolean) | undefined> = [
    undefined,
    () => true,
    (a, b) => a?.id === b?.id,
]

const READ_MODES = ["get", "sub", "scope-get", "scope-sub"] as const

type Failure = { seed: number; mode: string; detail: string }

const runSeed = (seed: number): Failure | undefined => {
    const rnd = mulberry32(seed)
    const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)]!
    const int = (lo: number, hi: number) =>
        lo + Math.floor(rnd() * (hi - lo + 1))

    const nodeCount = int(2, 7)
    const source = atom(1)
    const nodes: Array<{ state: any; deps: number[] }> = []

    for (let i = 0; i < nodeCount; i++) {
        // Earlier nodes only, which is what keeps the graph acyclic.
        const depCount = i === 0 ? 0 : int(0, Math.min(i, 3))
        const deps: number[] = []
        while (deps.length < depCount) {
            const candidate = int(0, i - 1)
            if (!deps.includes(candidate)) deps.push(candidate)
        }
        // The multiplier under test: each dependency is read 1..4 times in ONE
        // evaluation, so lost memoization shows up as reads x re-evaluations.
        const readsPer = deps.map(() => int(1, 4))
        const nullable = rnd() < 0.4
        const equal = nullable
            ? pick(NULLABLE_COMPARATORS)
            : pick(OBJECT_COMPARATORS)
        const captured = nodes.slice()
        const state = selector(
            get => {
                let sum = 0
                deps.forEach((dep, index) => {
                    for (let read = 0; read < readsPer[index]!; read++) {
                        const value = get(captured[dep]!.state)
                        sum += value && typeof value === "object" ? value.id : 0
                    }
                })
                sum += get(source)
                if (nullable && sum % 2 === 0) return undefined
                return { id: sum }
            },
            equal ? { equal: equal as any } : undefined,
        )
        nodes.push({ state, deps })
    }

    const rootIndex = nodeCount - 1
    const reachable = new Set<number>()
    const walk = (index: number) => {
        if (reachable.has(index)) return
        reachable.add(index)
        for (const dep of nodes[index]!.deps) walk(dep)
    }
    walk(rootIndex)

    const mode = pick(READ_MODES)
    const root: Store = store()
    const target = mode.startsWith("scope") ? root.scope("fuzz-scope") : root
    const rootState = nodes[rootIndex]!.state

    try {
        const cold = measureArchitecture(root, () => {
            if (mode.endsWith("sub")) target.sub(rootState, () => {})
            else target.get(rootState)
        })
        if (cold.selectorEvaluations !== reachable.size) {
            return {
                seed,
                mode,
                detail: `P1 cold evaluations ${cold.selectorEvaluations}, reachable nodes ${reachable.size}`,
            }
        }
        const settled = measureArchitecture(root, () => {
            for (let read = 0; read < 5; read++) target.get(rootState)
        })
        if (settled.selectorEvaluations !== 0) {
            return {
                seed,
                mode,
                detail: `P2 settled read evaluated ${settled.selectorEvaluations}`,
            }
        }
    } catch (error) {
        return {
            seed,
            mode,
            detail: `P3 threw: ${(error as Error).message.split("\n")[0]}`,
        }
    }
    return undefined
}

test("a random acyclic selector graph never re-evaluates a memoized node", () => {
    // 5,000 deterministic seeds, ~0.1s. Ten times what already produced 350
    // failures against the pre-fix core, so the budget is not the limit here.
    const SEEDS = 5_000
    const failures: Failure[] = []
    for (let seed = 1; seed <= SEEDS; seed++) {
        const failure = runSeed(seed)
        if (failure) failures.push(failure)
        // A systemic break would otherwise print 5,000 near-identical lines.
        if (failures.length >= 10) break
    }
    expect(failures.map(f => `seed ${f.seed} [${f.mode}] ${f.detail}`)).toEqual(
        [],
    )
})
