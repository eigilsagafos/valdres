/** Trace oracle · seeded state-machine.
 *
 *  Supplements the table-driven suites with fuzzed op sequences from a seeded
 *  PRNG (no Math.random → fully reproducible). Each step is checked two ways:
 *    1. Value equivalence — every atom and a derived sum selector match a plain
 *       reference model (validates the commit engine AND the dependency graph).
 *    2. Structural trace invariants that must hold on EVERY commit — commitEnd is
 *       last and fires exactly once, onChange fires exactly once per non-no-op
 *       commit, and every onSet precedes every subscriber.
 *
 *  A change that reorders the spine (e.g. commitEnd before subscribers) or drops
 *  the once-per-commit guarantee fails here across many randomized steps.
 *
 *  The generator uses mulberry32, NOT a bare LCG: an LCG's low-order bits have
 *  tiny periods (bit 0 period 2, bits 0-1 period 4), so deriving indices with
 *  `% 2` / `% 4` collapses the corpus (e.g. atoms 0 and 2 never written, only
 *  transaction sizes 1 and 3). mulberry32 mixes all bits, so `% bound` on its
 *  output is well distributed — guarded by the generator-coverage test below. */
import { describe, expect, test } from "bun:test"
import { store } from "../../src/store"
import type { Atom } from "../../src/types/Atom"
import {
    createRecorder,
    type Recorder,
    traceChange,
    traceCommitEnd,
    tracedAtom,
    tracedSelector,
    traceSub,
} from "./traceRecorder"

/** Deterministic mulberry32 PRNG with well-distributed bits. Returns an
 *  `int(bound)` helper. Seeded per run; never uses Math.random. */
const makeRng = (seed: number) => {
    let a = seed >>> 0
    const nextU32 = () => {
        a = (a + 0x6d2b79f5) | 0
        let t = Math.imul(a ^ (a >>> 15), 1 | a)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return (t ^ (t >>> 14)) >>> 0
    }
    return { int: (bound: number) => nextU32() % bound }
}

const N = 4 // atoms a0..a3
const VALUES = 5 // set values 0..4

type Step =
    | { kind: "set"; i: number; v: number }
    | { kind: "txn"; writes: Array<{ i: number; v: number }> }

const genStep = (rng: { int: (bound: number) => number }): Step => {
    if (rng.int(2) === 0) {
        return { kind: "set", i: rng.int(N), v: rng.int(VALUES) }
    }
    const k = 1 + rng.int(N)
    const writes = Array.from({ length: k }, () => ({
        i: rng.int(N),
        v: rng.int(VALUES),
    }))
    return { kind: "txn", writes }
}

/** Assert the invariants that hold on any commit given whether it changed state
 *  and whether the op is a transaction (a txn commits even with no change). */
const assertStructuralInvariants = (
    rec: Recorder,
    changed: boolean,
    isTxn: boolean,
) => {
    const events = rec.events
    const commitEnds = events.filter(e => e === "commitEnd")

    if (!changed && !isTxn) {
        // A no-op direct set does not commit at all.
        expect(events).toEqual([])
        return
    }

    // Exactly one commit boundary, and it is the very last event.
    expect(commitEnds).toHaveLength(1)
    expect(events[events.length - 1]).toBe("commitEnd")

    // onChange fires exactly once iff something actually changed.
    expect(events.filter(e => e === "onChange")).toHaveLength(changed ? 1 : 0)

    // Every onSet precedes every subscriber.
    const onSetIdxs = events.flatMap((e, i) => (e.startsWith("onSet:") ? [i] : []))
    const subIdxs = events.flatMap((e, i) => (e.startsWith("sub:") ? [i] : []))
    if (onSetIdxs.length && subIdxs.length) {
        expect(Math.max(...onSetIdxs)).toBeLessThan(Math.min(...subIdxs))
    }
    // Nothing is recorded after commitEnd.
    expect(events.lastIndexOf("commitEnd")).toBe(events.length - 1)
}

const runSeed = (seed: number, steps: number) => {
    const rec = createRecorder()
    const s = store()
    const atoms: Atom<number>[] = Array.from({ length: N }, (_, i) =>
        tracedAtom(rec, `a${i}`, 0),
    )
    const sum = tracedSelector(rec, "sum", get =>
        atoms.reduce((acc, a) => acc + (get(a) as number), 0),
    )
    atoms.forEach((a, i) => traceSub(rec, s, a, `a${i}`))
    traceSub(rec, s, sum, "sum")
    traceChange(rec, s, undefined, { selectors: true })
    traceCommitEnd(rec, s)

    const model = new Array<number>(N).fill(0)
    atoms.forEach(a => s.get(a)) // materialize so every write is a real op

    const rng = makeRng(seed)
    for (let step = 0; step < steps; step++) {
        const op = genStep(rng)
        const before = [...model]

        rec.clear()
        if (op.kind === "set") {
            model[op.i] = op.v
            s.set(atoms[op.i]!, op.v)
        } else {
            for (const w of op.writes) model[w.i] = w.v
            s.txn(({ set }) => {
                for (const w of op.writes) set(atoms[w.i]!, w.v)
            })
        }

        const changed = model.some((v, i) => v !== before[i])
        assertStructuralInvariants(rec, changed, op.kind === "txn")

        // Value equivalence: atoms and the derived selector match the model.
        for (let i = 0; i < N; i++) {
            expect(s.get(atoms[i]!)).toBe(model[i]!)
        }
        expect(s.get(sum)).toBe(model.reduce((a, b) => a + b, 0))
    }

    s.dispose()
}

/** Guard against a regression to a degenerate generator (the failure mode of a
 *  bare LCG's low bits): if the corpus collapses, the state-machine test above
 *  becomes a rubber stamp. For each seed's 120-step corpus, require both op
 *  kinds, every atom index written, and every transaction size 1..N. */
const corpusCoverage = (seed: number, steps: number) => {
    const rng = makeRng(seed)
    const kinds = new Set<Step["kind"]>()
    const atomsWritten = new Set<number>()
    const txnSizes = new Set<number>()
    for (let s = 0; s < steps; s++) {
        const op = genStep(rng)
        kinds.add(op.kind)
        if (op.kind === "set") atomsWritten.add(op.i)
        else {
            txnSizes.add(op.writes.length)
            op.writes.forEach(w => atomsWritten.add(w.i))
        }
    }
    return { kinds, atomsWritten, txnSizes }
}

describe("trace oracle · seeded state-machine", () => {
    test.each([1, 42, 1337])(
        "seed %i — generator corpus is well distributed (not degenerate)",
        seed => {
            const { kinds, atomsWritten, txnSizes } = corpusCoverage(seed, 120)
            // Both operation kinds appear.
            expect([...kinds].sort()).toEqual(["set", "txn"])
            // Every atom index is written at least once.
            expect([...atomsWritten].sort((a, b) => a - b)).toEqual([0, 1, 2, 3])
            // Every transaction size 1..N is represented.
            expect([...txnSizes].sort((a, b) => a - b)).toEqual([1, 2, 3, 4])
        },
    )

    test.each([1, 42, 1337])(
        "seed %i — value model + structural invariants hold over 120 steps",
        seed => {
            runSeed(seed, 120)
        },
    )
})
