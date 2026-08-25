import { describe, expect, test } from "bun:test"
import { atom } from "../atom"
import { selector } from "../selector"
import { store } from "../store"

/**
 * Differential soundness fuzzer for orphan DEMOTION — the shape produced when
 * the last observer of a selector unsubscribes and cleanup retains its value
 * behind a revision snapshot instead of dropping it (see graph/cleanupOrphanedDeps).
 *
 * Random mount/unmount churn is interleaved with writes and with the public
 * reads that drain the deferred orphan sweep, so selectors are audited while
 * live, while demoted, and while never mounted. Two properties are checked
 * after EVERY step, at every selector:
 *
 *   value        the public read equals an independent from-scratch recompute
 *   notification a subscribed selector fires whenever its value changed
 *
 * Selectors are declared as SPECS and the oracle evaluates the spec tree
 * directly. It never drives the store a second way — an oracle that reaches its
 * answer through the engine only finds order-INDEPENDENT bugs (see the
 * `setAtom` scope-shadow bug, which a store-driven oracle missed entirely).
 *
 * Deliberately NOT asserted here: `checkStoreInvariants(..., {quiescent: true})`.
 * That surfaces a PRE-EXISTING stranded-orphan shape (a selector left
 * graph-active with a forward set and no cold cache, because the cleanup walk
 * skips a node already visited at the current dependency-graph version and so
 * never descends to a child that became non-live later in the same version).
 * It reproduces identically with demotion reverted, has no effect on either
 * property above across 60k seeds, and retention stays weakly keyed on the
 * selector — so it is a separate concern, not this fuzzer's subject.
 *
 * Both store kinds run: `enumerable` stores keep a strong `values` Map and are
 * therefore excluded from demotion, so they exercise the drop path under the
 * same churn.
 */

const SEEDS = 2000

const rng = (seed: number) => () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

type Spec =
    | { kind: "sum"; deps: number[] }
    | { kind: "cond"; gate: number; whenTrue: number; whenFalse: number }

const runSeed = (seed: number): string | null => {
    const rnd = rng(seed * 2654435761)
    const pick = (n: number) => Math.floor(rnd() * n)

    const ATOMS = 3 + pick(4)
    const SELECTORS = 3 + pick(6)
    const enumerable = rnd() < 0.5

    const atomValues = Array.from({ length: ATOMS }, (_, i) => i + 1)
    const gates = Array.from({ length: ATOMS }, () => true)
    const atoms = atomValues.map(value => atom(value))
    const gateAtoms = gates.map(gate => atom(gate))

    // Specs reference only LOWER selector indices, so the graph is acyclic and
    // the oracle has a unique fixpoint. Cyclic liveness has its own coverage in
    // liveDependentCountChurn.test.ts.
    const specs: Spec[] = []
    for (let index = 0; index < SELECTORS; index++) {
        if (index > 0 && rnd() < 0.35) {
            specs.push({
                kind: "cond",
                gate: pick(ATOMS),
                whenTrue: pick(index),
                whenFalse: pick(index),
            })
        } else {
            const deps: number[] = []
            for (let d = 0, count = 1 + pick(3); d < count; d++) {
                // negative encodes an atom index, non-negative a selector index
                deps.push(
                    rnd() < 0.6 || index === 0 ? -1 - pick(ATOMS) : pick(index),
                )
            }
            specs.push({ kind: "sum", deps })
        }
    }

    const selectors: any[] = []
    for (let index = 0; index < SELECTORS; index++) {
        const spec = specs[index]!
        selectors.push(
            selector(get => {
                if (spec.kind === "cond") {
                    return get(gateAtoms[spec.gate]!)
                        ? get(selectors[spec.whenTrue])
                        : get(selectors[spec.whenFalse])
                }
                let total = 0
                for (const d of spec.deps) {
                    total += d < 0 ? get(atoms[-1 - d]!) : get(selectors[d])
                }
                return total
            }),
        )
    }

    const expected = (
        index: number,
        memo = new Map<number, number>(),
    ): number => {
        const hit = memo.get(index)
        if (hit !== undefined) return hit
        const spec = specs[index]!
        let value: number
        if (spec.kind === "cond") {
            value = gates[spec.gate]
                ? expected(spec.whenTrue, memo)
                : expected(spec.whenFalse, memo)
        } else {
            value = 0
            for (const d of spec.deps) {
                value += d < 0 ? atomValues[-1 - d]! : expected(d, memo)
            }
        }
        memo.set(index, value)
        return value
    }

    const testStore = store(
        undefined,
        enumerable ? { enumerable: true } : undefined,
    )
    const drain = atom(0)
    const subs = new Map<number, () => void>()
    const notified = new Set<number>()
    let lastSeen = new Map<number, number>()
    const at = `seed ${seed} (enumerable=${enumerable})`

    for (let step = 0, steps = 25 + pick(25); step < steps; step++) {
        const roll = rnd()
        if (roll < 0.22) {
            const index = pick(ATOMS)
            atomValues[index] += 1 + pick(3)
            testStore.set(atoms[index]!, atomValues[index]!)
        } else if (roll < 0.32) {
            const index = pick(ATOMS)
            gates[index] = !gates[index]
            testStore.set(gateAtoms[index]!, gates[index]!)
        } else if (roll < 0.58) {
            const index = pick(SELECTORS)
            if (!subs.has(index))
                subs.set(
                    index,
                    testStore.sub(selectors[index], () => notified.add(index)),
                )
        } else if (roll < 0.84) {
            const index = pick(SELECTORS)
            const unsubscribe = subs.get(index)
            if (unsubscribe) {
                subs.delete(index)
                unsubscribe()
            }
        } else {
            // A public read of an unrelated atom drains the queued orphan sweep,
            // which is what actually performs the demotion.
            testStore.get(drain)
        }

        for (let index = 0; index < SELECTORS; index++) {
            const got = testStore.get(selectors[index])
            const want = expected(index)
            if (got !== want)
                return `${at} step ${step}: sel${index} = ${got}, expected ${want}`
        }
        for (const index of subs.keys()) {
            const now = expected(index)
            const before = lastSeen.get(index)
            if (before !== undefined && before !== now && !notified.has(index))
                return `${at} step ${step}: sel${index} changed ${before} -> ${now} without notifying its subscriber`
        }
        lastSeen = new Map(
            Array.from({ length: SELECTORS }, (_, index) => [
                index,
                expected(index),
            ]),
        )
        notified.clear()
    }

    // Full teardown demotes (or drops) everything at once; values must survive.
    for (const unsubscribe of subs.values()) unsubscribe()
    testStore.get(drain)
    for (let index = 0; index < SELECTORS; index++) {
        const got = testStore.get(selectors[index])
        if (got !== expected(index))
            return `${at} post-teardown: sel${index} = ${got}, expected ${expected(index)}`
    }
    return null
}

describe("orphan demotion fuzz (mount/unmount churn)", () => {
    test("public reads and notifications match the spec oracle at every step", () => {
        for (let seed = 1; seed <= SEEDS; seed++) {
            const failure = runSeed(seed)
            expect(failure).toBeNull()
        }
    })
})
