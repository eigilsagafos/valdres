// Collected by BOTH runners: `bun test` here and the V8 lane through
// vitest.rewrite-guards.config.ts, where `bun:test` does not resolve. Its
// siblings all import the same shim, so this does too.
import { describe, expect, test } from "../../test/performance/test-compat"
import { atom } from "../atom"
import { selector } from "../selector"
import { store } from "../store"
import { SelectorCircularDependencyError } from "../errors/SelectorCircularDependencyError"

/**
 * A SEMANTIC oracle for cold-selector reads, over the two shapes that defeated
 * the scenario tests:
 *
 *  - DYNAMIC CYCLES. A graph warmed while acyclic and then flipped onto a branch
 *    that reads its own dependents. Stability is not the property to check here —
 *    a latched snapshot is perfectly stable and wrong. The check is that every
 *    value the store actually serves agrees with its own body over the values
 *    that same store serves, and that a read which cannot satisfy that throws the
 *    documented cycle error instead.
 *  - EQUAL-RESULT RE-ENTRANT WRITES. A selector that writes to an atom during
 *    evaluation and returns a value that does NOT change. The unchanged return is
 *    what makes it dangerous: the writer's own revision never moves, so nothing
 *    in the ordinary revision path invalidates its parent, and the defect hid
 *    behind every test whose saboteur happened to return something different.
 *
 * Both were reported against the validation pass and are the reason
 * `coldValidationMayRecord` exists. Fuzzing them here rather than in a scratch
 * harness is deliberate: the failures are order-dependent, and each individual
 * scenario test only pins the one ordering it was written from.
 */

/** Deterministic PRNG — a seeded fuzz has to be reproducible from its seed. */
const rng = (seed: number) => () =>
    (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff

type Probe = { value: number | null; threw: boolean }

const readProbe = (target: any, state: any): Probe => {
    try {
        return { value: target.get(state) as number, threw: false }
    } catch (error) {
        expect(error).toBeInstanceOf(SelectorCircularDependencyError)
        return { value: null, threw: true }
    }
}

describe("cold validation semantic fuzz", () => {
    test("every served cold selector value satisfies its own body", () => {
        for (let seed = 1; seed <= 150; seed++) {
            const next = rng(seed)
            const atomCount = 2 + Math.floor(next() * 3)
            const selectorCount = 2 + Math.floor(next() * 4)
            const atoms = Array.from({ length: atomCount }, () => atom(1))
            const gate = atom(0)
            // Which selectors each selector reads once `gate` is truthy. Chosen
            // up front so the oracle can replay the exact same body.
            const crossReads = Array.from({ length: selectorCount }, () =>
                Array.from({ length: selectorCount }, () => next() < 0.45),
            )
            const ownAtom = Array.from({ length: selectorCount }, () =>
                Math.floor(next() * atomCount),
            )
            // Some selectors read their cross-dependencies UNCONDITIONALLY. This
            // is what makes an ASYMMETRIC cycle reachable — one side flips onto
            // the cycle while the other was always on it — and a symmetric
            // generator (every cross-read behind the same gate) never produces
            // the shape that latches, it only produces shapes that throw.
            const unconditional = Array.from(
                { length: selectorCount },
                () => next() < 0.4,
            )
            const selectors: any[] = []
            for (let i = 0; i < selectorCount; i++) {
                selectors.push(
                    selector((get: any) => {
                        let acc = 1 + get(atoms[ownAtom[i]!]!)
                        if (unconditional[i]! || get(gate)) {
                            for (let k = 0; k < selectorCount; k++) {
                                // Self-reads are excluded: a selector reading
                                // itself is a different (static) error.
                                if (k !== i && crossReads[i]![k]!) {
                                    // Clamp so a divergent cycle stays finite and
                                    // the oracle can still compare numbers.
                                    acc += Math.min(
                                        get(selectors[k]) as number,
                                        500,
                                    )
                                }
                            }
                        }
                        return acc
                    }),
                )
            }

            const target = store()
            /** Recompute each body over what the store serves RIGHT NOW. */
            const assertConsistent = (at: string) => {
                const served = selectors.map(s => readProbe(target, s))
                const gateOn = target.get(gate) as number
                const atomValues = atoms.map(a => target.get(a) as number)
                for (let i = 0; i < selectorCount; i++) {
                    // A read that threw made no claim about a value.
                    if (served[i]!.threw) continue
                    let expected = 1 + atomValues[ownAtom[i]!]!
                    let comparable = true
                    if (unconditional[i]! || gateOn) {
                        for (let k = 0; k < selectorCount; k++) {
                            if (k === i || !crossReads[i]![k]!) continue
                            // A dependency the store refuses to produce leaves
                            // this body unverifiable, not wrong.
                            if (served[k]!.threw) {
                                comparable = false
                                break
                            }
                            expected += Math.min(served[k]!.value!, 500)
                        }
                    }
                    if (!comparable) continue
                    expect({
                        seed,
                        at,
                        selector: i,
                        served: served[i]!.value,
                    }).toEqual({ seed, at, selector: i, served: expected })
                }
            }

            // Warm every snapshot. `unconditional` selectors may already form a
            // STATIC cycle here, which legitimately throws — tolerate it via the
            // probe rather than letting it escape as a test failure.
            selectors.forEach(s => readProbe(target, s))
            assertConsistent("warm")
            // Close the cycles, then churn sources in a read/write interleave.
            target.set(gate, 1)
            assertConsistent("closed")
            for (let step = 0; step < 5; step++) {
                target.set(atoms[step % atomCount]!, 2 + step)
                assertConsistent(`step${step}`)
                // Read again with nothing changed: the memo path must agree
                // with the walk that produced it.
                assertConsistent(`step${step}-repeat`)
            }
        }
    })

    test("a re-entrant write is never laundered, whatever the writer returns", () => {
        // `returnsConstant` is the half that used to pass vacuously: when the
        // writer's own value changes, its revision moves and the ordinary path
        // invalidates the parent regardless of the pass machinery.
        for (const returnsConstant of [true, false]) {
            for (let seed = 1; seed <= 60; seed++) {
                const next = rng(seed)
                const trigger = atom(0)
                const written = atom(1)
                const spectatorCount = 1 + Math.floor(next() * 3)
                const multipliers = Array.from(
                    { length: spectatorCount },
                    () => 1 + Math.floor(next() * 9),
                )
                let target: any
                // Read `written`, so each is invalidated by the re-entrant write.
                const spectators = multipliers.map(m =>
                    selector((get: any) => (get(written) as number) * m),
                )
                const writeValue = 2 + Math.floor(next() * 20)
                const saboteur = selector((get: any) => {
                    const t = get(trigger) as number
                    if (t === 1) target.set(written, writeValue)
                    return returnsConstant ? 0 : t
                })
                // Order matters: spectators are validated BEFORE the saboteur
                // writes, so the parent stamps over revisions already void.
                const parent = selector((get: any) => {
                    let sum = 0
                    for (const s of spectators) sum += get(s) as number
                    return sum + (get(saboteur) as number)
                })
                target = store()

                const before = multipliers.reduce((a, m) => a + m, 0)
                expect(target.get(parent)).toBe(before)

                target.set(trigger, 1)
                // Drive the read that trips the re-entrancy, then settle.
                target.get(parent)
                const spectatorSum = multipliers.reduce(
                    (a, m) => a + writeValue * m,
                    0,
                )
                const saboteurValue = returnsConstant ? 0 : 1
                // The store must not go on serving a parent that contradicts the
                // children it is defined as summing.
                for (let round = 0; round < 3; round++) {
                    spectators.forEach((s, i) =>
                        expect(target.get(s)).toBe(
                            writeValue * multipliers[i]!,
                        ),
                    )
                    expect(target.get(parent)).toBe(
                        spectatorSum + saboteurValue,
                    )
                }
            }
        }
    })
})
