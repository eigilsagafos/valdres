/**
 * Which benchmarks carry decisions.
 *
 * Two rules pick the protected family, and both exist to keep it small:
 *
 *  - Explicit membership. The set below is one benchmark per subsystem, chosen
 *    to be the aggregated workload that a regression in that subsystem has to
 *    pass through. Everything else in the deep suite stays informational. The
 *    protected family blocks pull requests; keeping it small makes the FDR
 *    adjustment in paired-decision.ts affordable at four to twelve pairs.
 *
 *  - A timing floor. A raw operation measured in nanoseconds cannot be gated on
 *    a CI runner: the +10% budget lands inside the JIT-tier and timer noise, and
 *    the observed failure mode is exactly that (`set(atom, value)` reading
 *    131/351/131 ns within one job). Those operations are demoted to
 *    informational automatically, whatever the set says, and their hot path is
 *    covered by an aggregated equivalent that runs the same code thousands of
 *    times per sample.
 */
import { isReference, opName } from "./benchmark-names"

/** Below this, a single-operation p50 is noise-dominated on a CI runner. */
export const TIMING_FLOOR_NS = 1_000

/**
 * One decision-bearing workload per subsystem. Every entry is micro- to
 * millisecond scale on both runtimes, so the budget sits well clear of the
 * timing floor.
 */
export const PROTECTED_OPS = new Set([
    "atom lifecycle (create+100get+100set)",
    "get 1000 atoms",
    "set 1000 atoms",
    "set + read 100 selectors",
    "selectorFamily: lookup 10,000 retained entries",
    "atomFamily: direct create + delete 500 members",
    "txn: cross-atom 1000 selectors, with subs",
    "txn: large asymmetric DAG (1000 leaves × 50 chain)",
    "subscribe + unsubscribe 100 shared selector pairs",
    "architecture: live graph fan-out 100",
    "scope: set atom, 1000 scopes (no shadow)",
])

/**
 * Where each sub-microsecond operation's hot path is actually gated. The value
 * is the protected aggregate that exercises the same code, or `null` when the
 * operation has no aggregated equivalent and is knowingly unguarded.
 *
 * This map is the standing argument that demoting tiny benchmarks does not
 * create a blind spot, and the test beside it fails if an aggregate is renamed
 * out from under an entry.
 */
export const AGGREGATED_EQUIVALENTS: Record<string, string | null> = {
    "atom(1)": "atom lifecycle (create+100get+100set)",
    "store.get(atom)": "get 1000 atoms",
    "set(atom, value)": "set 1000 atoms",
    "set(atom, curr => curr+1)": "atom lifecycle (create+100get+100set)",
    "set(atom) with 10 subs": "architecture: live graph fan-out 100",
    "sub + unsub": "subscribe + unsubscribe 100 shared selector pairs",
    "selector(fn)": "set + read 100 selectors",
    "selectorFamily(id)": "selectorFamily: lookup 10,000 retained entries",
    "selectorFamily(number) cache hit":
        "selectorFamily: lookup 10,000 retained entries",
    "selectorFamily(string) cache hit":
        "selectorFamily: lookup 10,000 retained entries",
    "atomFamily(id)": "atomFamily: direct create + delete 500 members",
    "atomFamily(id) cache hit":
        "atomFamily: direct create + delete 500 members",
    "atomFamily(string) cache hit":
        "atomFamily: direct create + delete 500 members",
    // Construction is exercised at a stable scale by the many-root benchmark,
    // but that row includes disposal on Valdres and creation only on Jotai. It
    // remains informational rather than claiming decision-grade equivalence.
    createStore: null,
}

/**
 * A benchmark is protected when it is a valdres-owned member of the set AND its
 * base measurement clears the timing floor.
 */
export function isProtected(benchmark: string, baseNs: number): boolean {
    return (
        !isReference(benchmark) &&
        PROTECTED_OPS.has(opName(benchmark)) &&
        baseNs >= TIMING_FLOOR_NS
    )
}

/** True when the base measurement is too small to decide on directly. */
export function isSubMicrosecond(baseNs: number): boolean {
    return baseNs < TIMING_FLOOR_NS
}
