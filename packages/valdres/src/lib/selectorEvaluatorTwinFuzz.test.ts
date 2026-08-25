// `test-compat`, not `bun:test`: `src/lib/*Fuzz.test.ts` is an explicit include
// of the Node/V8 rewrite-guard lane (vitest.rewrite-guards.config.ts), where
// `bun:test` does not resolve. Its siblings all import the same shim, so this
// invariant gets checked on both JSC and V8 — which matters here, because the
// twin split exists for JIT reasons and V8 and JSC do not tier identically.
import { describe, expect, test } from "../../test/performance/test-compat"
import { atom } from "../atom"
import { atomFamily } from "../atomFamily"
import { selector } from "../selector"
import { store } from "../store"
import type { Selector } from "../types/Selector"
import type { State } from "../types/State"
import type { Store } from "../types/Store"
import { checkStoreInvariants } from "../../test/invariants/checkStoreInvariants"
import { measureArchitecture } from "../../test/utils/measureArchitecture"
import { getStoreData } from "./getStoreData"

// Differential fuzz for the selector-evaluator twins.
//
// `evaluateLiveOnlySelector` and `evaluateSelector` share 72 of the live-only
// evaluator's 124 non-comment lines. The duplication is deliberate — a single
// mixed-mode function is what the split exists to avoid, and the measured cost
// of merging them is why it stays. So this file does not try to remove it; it
// makes the pairing checkable.
//
// THE SWITCH. Which twin runs is decided by one store-wide flag:
//
//   liveOnly = selectorGraphActive && !data.coldSelectorCachesEnabled
//
// `coldSelectorCachesEnabled` is false until the store records its FIRST cold
// selector cache, and never goes back. So a single cold read of a throwaway
// selector — one that shares nothing with the graph under test — moves an
// otherwise identical store onto the other evaluator. That is the entire
// difference between the two runs below: same seed, same world shape, same op
// sequence, one throwaway read. Everything a consumer can observe must match.
//
// WHAT IS COMPARED, and why each part earns its place:
//   - the value (or error) of every read           — the point of an evaluator
//   - every subscriber delivery, in order          — a store can be correct and
//                                                    silent; see the sibling
//                                                    unsetAllDifferentialFuzz
//   - the final forward AND reverse edge tables    — the twins' install halves
//     plus liveDependentCount                        (installEvaluationDeps /
//                                                    ...LiveOnly) write these
//   - checkStoreInvariants on every store          — self-consistency, not just
//                                                    matching wrong answers
//   - per-op selector evaluation counts, for the prefix before the live-only
//     store flips its own flag (see FLIP below)
//
// FLIP. The unprimed store flips the flag itself the moment the program does a
// cold read. From that op on, the two stores are in the same MODE but have
// different cold-cache HISTORIES, and a cache hit legitimately costs fewer
// evaluations than a miss. Values and edges are still comparable (a cache is
// transparent); evaluation counts are not, so they are compared only up to the
// flip. Seeds that never flip are counted, and a floor is asserted — without it
// this whole file could quietly degrade into running one evaluator twice.
//
// WHAT THIS FILE GUARDS, each verified by deleting the line and watching it
// fail: the twin read getters (dirty-family observation, fresh-selector
// activation and its rollback, the repeated-read dep gate), the twin installers'
// edge diff, removal diff, graph-changed note and mount-closure marker, error
// PARITY down the cause chain, and the DISPATCHER PREDICATE itself — dropping
// the `coldSelectorCachesEnabled` term, so the live-only evaluator is paired
// with the general installer, surfaces as a liveDependentCount ground-truth
// violation.
//
// WHAT IT DOES NOT — measured, not assumed. A green run here is not proof that a
// one-sided change to either twin is safe. Four branches survive deleting them,
// each owned elsewhere; go to the named file when you touch one:
//
//   1. The cycle-gated liveness arms (`livenessLazyArmed`,
//      `livenessRemovalArmed`). Instrumenting `installEvaluationDepsLiveOnly`
//      across a full run: 3,909 calls, of which the arms fire twice and zero
//      times. They need a lazy re-init to land INSIDE an active propagation
//      pass, which this op mix reaches by accident at best.
//          -> livenessCyclicFuzz.test.ts fails on both.
//   2. The live-only evaluator's own post-loop dep-set SIZE check. Passes at
//      1,500 seeds, fails at ~6,000. Propagation re-evaluates through
//      `evaluateSelector` even on a live-only store (see
//      propagateUpdatedAtoms.reEvaluateSelector), so this check is only
//      load-bearing on a LAZY re-read of an already-materialized selector. The
//      branch generator below is biased toward equal-size/different-membership
//      dep sets to widen that window, which recovered the INSTALLER's removal
//      diff but not this.
//          -> raise SEEDS, or add an op that remounts a still-live selector.
//   3. The installers' capture-to-install interval merge, which only matters
//      when a deferred `get` runs in that window — unreachable from a
//      synchronous op mix.
//          -> graph/runtime.test.ts ("installer twin parity" and "late
//             dependency install") fails on both twins.
//   4. Anything else async. The deferred (post-await, post-timeout) `get` path
//      is a named condition rather than a distribution, so the one twin
//      difference that ever existed there gets its own test at the bottom of
//      this file rather than fuzz coverage.

const mulberry32 = (seed: number) => () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

const ATOM_COUNT = 3
const SELECTOR_COUNT = 5
const MEMBER_KEYS = ["m0", "m1", "m2"]

type Ref =
    | { kind: "atom"; index: number }
    | { kind: "member"; key: string }
    | { kind: "family" }
    | { kind: "selector"; index: number }
    /** The same dependency read again in one evaluation — the case that made
     *  dep-set change detection use a Set instead of a count. */
    | { kind: "repeat" }

/** Both twins read dependencies through structurally identical getters, so the
 *  world only has to be interesting: dynamic dep sets, repeated reads, family
 *  membership observation, and selector->selector edges that form GRAPH cycles
 *  without any single evaluation recursing (branch B is only reachable when the
 *  gate atom's parity flips). Cycles are where liveness bookkeeping has
 *  actually broken before, so they are in scope on purpose. */
const createWorld = (seed: number) => {
    const rnd = mulberry32(seed)
    const int = (lo: number, hi: number) =>
        lo + Math.floor(rnd() * (hi - lo + 1))

    // `onMount` on a leaf AND on a selector: the mount/unmount closure walk is
    // what `noteDependencyAdded`'s marker skips and what the liveness arms
    // schedule, so without a hook to run there is nothing to observe and a
    // dropped marker looks exactly like a correct one.
    const mounts: string[] = []
    const mountHook = (label: string) => () => {
        mounts.push(`+${label}`)
        return () => mounts.push(`-${label}`)
    }
    const atoms = Array.from({ length: ATOM_COUNT }, (_, i) =>
        i === 1 ? atom(i + 1, { onMount: mountHook(`a${i}`) }) : atom(i + 1),
    )
    const family = atomFamily<number, [string]>(key => key.length, {
        onMount: (_store, state: any) =>
            mountHook(`member:${state.familyArgs[0]}`)(),
    })
    const selectors: Selector<any>[] = []

    const refsFor = (self: number, allowForward: boolean): Ref[] => {
        const refs: Ref[] = []
        const count = int(1, 3)
        for (let i = 0; i < count; i++) {
            const roll = rnd()
            if (roll < 0.3)
                refs.push({ kind: "atom", index: int(0, ATOM_COUNT - 1) })
            else if (roll < 0.5)
                refs.push({
                    kind: "member",
                    key: MEMBER_KEYS[int(0, MEMBER_KEYS.length - 1)]!,
                })
            else if (roll < 0.6) refs.push({ kind: "family" })
            else if (roll < 0.72) refs.push({ kind: "repeat" })
            else {
                // Branch A stays below `self` (acyclic); branch B may point
                // above it, which is what puts a cycle in the graph.
                const index = allowForward
                    ? int(0, SELECTOR_COUNT - 1)
                    : int(0, Math.max(0, self - 1))
                if (index !== self) refs.push({ kind: "selector", index })
            }
        }
        return refs
    }

    for (let index = 0; index < SELECTOR_COUNT; index++) {
        const branchA = refsFor(index, false)
        // Usually an independent set; sometimes branch A with ONE ref swapped,
        // so the two branches have the SAME dep count and different membership.
        // That is the exact shape the evaluator's post-loop size check exists
        // for — a dep dropped while the count coincidentally stayed equal, which
        // a count-based diff would miss and leave as a stale reverse edge.
        // Independent random branches produce it only by luck: deleting that
        // check needed ~6,000 seeds to fail before this, and ~1,500 after.
        const branchB =
            branchA.length > 0 && rnd() < 0.45
                ? (() => {
                      // Same self-reference guard `refsFor` applies: a selector
                      // reading itself is an unconditional cycle error, not a
                      // dep-set shape.
                      const swapAt = int(0, branchA.length - 1)
                      const target =
                          (index + 1 + int(0, SELECTOR_COUNT - 2)) %
                          SELECTOR_COUNT
                      return branchA.map((ref, at) =>
                          at === swapAt
                              ? ({ kind: "selector", index: target } as Ref)
                              : ref,
                      )
                  })()
                : refsFor(index, true)
        // One selector compares by a custom equal, one returns an object: both
        // are memoization surfaces the evaluator feeds but does not own.
        const returnsObject = index === SELECTOR_COUNT - 1
        // A gate PER SELECTOR, not one global gate. With a shared gate every
        // selector switches branch together, so a directed cycle in branch B
        // either throws on evaluation or never forms — and the cycle-gated
        // liveness reconcile is never load-bearing. Independent gates let
        // selector i sit on branch B while j sits on branch A, which is how the
        // graph carries a cycle that no single evaluation recurses through.
        const gate = atoms[index % ATOM_COUNT]!
        // Some bodies throw a USER error on a third gate value. Without this the
        // only error the fuzz could produce was SelectorCircularDependencyError
        // — which extends SelectorEvaluationError, so it is re-thrown UNWRAPPED
        // with no `cause` and (for anonymous selectors) a constant message. That
        // made every throwing seed indistinguishable, so the oracle's error
        // resolution was never under pressure. A user throw takes the wrapping
        // path instead: SelectorEvaluationError with a distinct `cause`, which
        // is also the branch that runs rollbackFreshSelectorActivations.
        //
        // Tuned, not guessed. Throwing bodies suppress the successful
        // evaluations that churn the dependency graph, and making every other
        // selector throw on one gate value in three cost real detection: the
        // "installer drops the removal diff" mutation stopped failing. Two
        // selectors of five, on one gate value in five, keeps that mutation
        // caught AND still produces two distinct wrapped causes, at 527 of 1,500
        // seeds throwing (up from 182 before bodies could throw at all).
        const throwsOnGate = index % 3 === 1
        selectors.push(
            selector(
                get => {
                    if (throwsOnGate && get(gate) % 5 === 4) {
                        throw new Error(`body-${index} refused`)
                    }
                    const refs = get(gate) % 2 === 0 ? branchA : branchB
                    let sum = 0
                    let last: State | undefined
                    for (const ref of refs) {
                        switch (ref.kind) {
                            case "atom":
                                last = atoms[ref.index]!
                                sum += get(atoms[ref.index]!)
                                break
                            case "member":
                                last = family(ref.key)
                                sum += get(family(ref.key))
                                break
                            case "family":
                                last = family
                                sum += get(family).length
                                break
                            case "selector": {
                                const dep = selectors[ref.index]
                                if (!dep) break
                                last = dep
                                const value = get(dep)
                                sum +=
                                    typeof value === "object" && value !== null
                                        ? (value as any).sum
                                        : Number(value ?? 0)
                                break
                            }
                            case "repeat":
                                // Re-read whatever was read last. A lost
                                // memoization shows up as reads x re-evals, and
                                // a count-based dep diff would mask a removal.
                                if (last) sum += Number(get(last as any) ?? 0)
                                break
                        }
                    }
                    return returnsObject ? ({ sum } as any) : sum
                },
                index === 1
                    ? { equal: (a: any, b: any) => a === b }
                    : index === 2
                      ? { onMount: mountHook("s2") }
                      : undefined,
            ),
        )
    }
    return { atoms, family, selectors, mounts }
}

type World = ReturnType<typeof createWorld>

const labelsFor = (world: World) => {
    const labels = new Map<State, string>()
    world.atoms.forEach((a, i) => labels.set(a, `a${i}`))
    labels.set(world.family, "family")
    MEMBER_KEYS.forEach(key => labels.set(world.family(key), `member:${key}`))
    world.selectors.forEach((s, i) => labels.set(s, `s${i}`))
    return labels
}

const allStates = (world: World): State[] => [
    ...world.atoms,
    world.family,
    ...MEMBER_KEYS.map(key => world.family(key)),
    ...world.selectors,
]

/** Flatten an error and its `cause` chain into one comparable string.
 *
 *  The outer class alone is not enough: `SelectorEvaluationError` is
 *  constructed with `super()` (no message) and carries the real failure in
 *  `cause`, so two twins could fail for entirely different reasons and compare
 *  equal. Its `message` is a computed getter naming the selector, which is a
 *  constant here because these selectors are deliberately anonymous — leaving
 *  `cause` as the only discriminator. Depth-capped because a cause chain can be
 *  cyclic, and first message line only, since the tail is a rendered
 *  selector trace whose ordering is not part of the contract. */
const showError = (error: unknown): string => {
    const parts: string[] = []
    let current: any = error
    for (let depth = 0; current && depth < 5; depth++) {
        const name =
            current instanceof Error
                ? (current.name ?? current.constructor?.name)
                : typeof current
        const message = String(current?.message ?? current).split("\n")[0]
        parts.push(`${name}(${message})`)
        current = current.cause
    }
    return parts.join(" <- ")
}

/** Serialize a read so a value and an error are comparable in one trace slot. */
const show = (read: () => unknown): string => {
    try {
        const value = read()
        if (value === null || typeof value !== "object") return String(value)
        if (Array.isArray(value)) {
            // `get(family)` returns member atoms; identity is per-world, so
            // compare the family args.
            return `[${value
                .map((m: any) => String(m?.familyArgs?.[0] ?? "?"))
                .sort()
                .join(",")}]`
        }
        return JSON.stringify(value)
    } catch (error) {
        return `!${showError(error)}`
    }
}

/** Forward edges, reverse edges and the incrementally maintained liveness count
 *  for every state in the world — the tables the twins' install halves own. */
const graphSnapshot = (
    target: Store,
    world: World,
    labels: Map<State, string>,
) => {
    const data = getStoreData(target)
    const label = (state: State) => labels.get(state) ?? "<external>"
    const edges = (map: WeakMap<State, Set<State>>, state: State) =>
        [...(map.get(state) ?? [])].map(label).sort().join(",")
    return allStates(world).map(state =>
        [
            label(state),
            `deps=${edges(data.stateDependencies as any, state)}`,
            `dependents=${edges(data.stateDependents as any, state)}`,
            `live=${data.liveDependentCount.get(state) ?? 0}`,
            `committed=${data.values.has(state)}`,
        ].join(" "),
    )
}

type Step = {
    op: string
    result: string
    notified: string
    /** Compared only while the unprimed store has not flipped its own flag. */
    evaluations: number
    coldCachesEnabled: boolean
    /** Edge tables + liveness counts AFTER this op, for both stores in the
     *  tree. Checked per op, not just at teardown: a mount marker or liveness
     *  arm the live-only installer forgets to set shows up while the graph is
     *  still churning and is gone by the time every subscription is released. */
    graph: string
    /** Self-consistency of the same mid-churn state. */
    violations: string
    /** onMount/cleanup calls this op ran, and the engine's own tally of
     *  absent->mounted / mounted->absent transitions. */
    mounted: string
}

type Run = {
    steps: Step[]
    /** Step index at which the store's cold-cache flag turned on, or -1. */
    flippedAt: number
}

const OPS = [
    "get-selector",
    "sub-selector",
    "unsub-selector",
    "set-atom",
    "set-member",
    "del-member",
    "get-family",
    "txn-multi",
    "scope-get",
    "scope-sub",
] as const

const runProgram = (seed: number, prime: boolean): Run => {
    const rnd = mulberry32(seed)
    const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)]!
    const int = (lo: number, hi: number) =>
        lo + Math.floor(rnd() * (hi - lo + 1))

    const world = createWorld(seed)
    const labels = labelsFor(world)
    const root: Store = store()
    const data = getStoreData(root)

    if (prime) {
        // The switch, pulled deliberately: one cold read of a selector that
        // shares nothing with `world`, so the program below is byte-for-byte the
        // same work on the other evaluator.
        root.get(selector(() => 0))
    }
    const scope = root.scope("s")

    const notifications: string[] = []
    const unsubscribes = new Map<string, () => void>()
    const subscribe = (target: Store, state: Selector<any>, key: string) => {
        if (unsubscribes.has(key)) return
        unsubscribes.set(
            key,
            target.sub(state, () =>
                notifications.push(`${key}->${show(() => target.get(state))}`),
            ),
        )
    }

    const steps: Step[] = []
    let flippedAt = -1
    const opCount = int(6, 18)

    for (let index = 0; index < opCount; index++) {
        const op = pick(OPS)
        const selectorIndex = int(0, SELECTOR_COUNT - 1)
        const atomIndex = int(0, ATOM_COUNT - 1)
        const key = pick(MEMBER_KEYS)
        const value = int(0, 40)
        let result = "ok"
        const counters = measureArchitecture(root, () => {
            switch (op) {
                case "get-selector":
                    result = show(() =>
                        root.get(world.selectors[selectorIndex]!),
                    )
                    break
                case "sub-selector":
                    // A subscribe evaluates the selector, so it can throw for
                    // exactly the reasons a read can (a cycle, most often).
                    result = show(() =>
                        subscribe(
                            root,
                            world.selectors[selectorIndex]!,
                            `root:s${selectorIndex}`,
                        ),
                    )
                    break
                case "unsub-selector": {
                    const release = unsubscribes.get(`root:s${selectorIndex}`)
                    if (release) {
                        release()
                        unsubscribes.delete(`root:s${selectorIndex}`)
                        result = "released"
                    } else result = "absent"
                    break
                }
                case "set-atom":
                    result = show(() =>
                        root.set(world.atoms[atomIndex]!, value),
                    )
                    break
                case "set-member":
                    result = show(() => root.set(world.family(key), value))
                    break
                case "del-member":
                    result = show(() => root.del(world.family(key)))
                    break
                case "get-family":
                    result = show(() => root.get(world.family))
                    break
                case "txn-multi":
                    result = show(() =>
                        root.txn(txn => {
                            txn.set(world.atoms[atomIndex]!, value)
                            txn.set(world.family(key), value + 1)
                        }),
                    )
                    break
                case "scope-get":
                    result = show(() =>
                        scope.get(world.selectors[selectorIndex]!),
                    )
                    break
                case "scope-sub":
                    result = show(() =>
                        subscribe(
                            scope,
                            world.selectors[selectorIndex]!,
                            `scope:s${selectorIndex}`,
                        ),
                    )
                    break
            }
        })
        if (flippedAt === -1 && data.coldSelectorCachesEnabled)
            flippedAt = index
        steps.push({
            op: `${index}:${op}`,
            result,
            // Ordering ACROSS independent subscriptions is not part of the
            // contract; the set delivered by one op is.
            notified: notifications.splice(0).sort().join(" | "),
            evaluations: counters.selectorEvaluations,
            coldCachesEnabled: data.coldSelectorCachesEnabled,
            mounted: `${world.mounts.splice(0).sort().join(",")} up=${counters.mountTransitions} down=${counters.unmountTransitions}`,
            graph: [
                ...graphSnapshot(root, world, labels),
                ...graphSnapshot(scope, world, labels),
            ].join("\n"),
            // `quiescent` is deliberately OFF: the orphan sweep is microtask-
            // batched, so mid-churn graph is legitimately not yet cleaned.
            violations: [
                ...checkStoreInvariants(root, { states: allStates(world) }),
                ...checkStoreInvariants(scope, { states: allStates(world) }),
            ]
                .map(String)
                .join("; "),
        })
    }

    const run: Run = { steps, flippedAt }
    for (const release of unsubscribes.values()) release()
    scope.detach()
    root.dispose()
    return run
}

type Coverage = {
    /** Seeds whose program never flipped the unprimed store — the only ones
     *  where the two runs are a pure head-to-head of the twins throughout. */
    pureLiveOnly: number
    /** Seeds where a selector read threw (cycle errors are in scope). */
    sawThrow: number
    /** Seeds that delivered at least one subscriber notification. */
    sawNotification: number
    /** Seeds where the graph actually held selector->selector edges. */
    sawSelectorEdges: number
    /** Seeds that ran at least one onMount or cleanup. */
    sawMount: number
}

const compare = (seed: number, coverage: Coverage): string[] => {
    const liveOnly = runProgram(seed, false)
    const mixed = runProgram(seed, true)
    const failures: string[] = []
    const at = (detail: string) => failures.push(`seed ${seed}: ${detail}`)

    if (liveOnly.flippedAt === -1) coverage.pureLiveOnly++
    if (liveOnly.steps.some(step => step.result.startsWith("!")))
        coverage.sawThrow++
    if (liveOnly.steps.some(step => step.notified.length > 0))
        coverage.sawNotification++
    if (liveOnly.steps.some(step => /deps=[^ ]*s\d/.test(step.graph)))
        coverage.sawSelectorEdges++
    if (
        liveOnly.steps.some(
            step =>
                step.mounted.startsWith("+") || step.mounted.startsWith("-"),
        )
    )
        coverage.sawMount++

    // The primed store must be the primed one: a prime that silently stopped
    // working would make every assertion below vacuous.
    if (mixed.steps[0] && !mixed.steps[0].coldCachesEnabled) {
        at("priming failed — the mixed run never enabled cold caches")
        return failures
    }

    if (liveOnly.steps.length !== mixed.steps.length) {
        at(`step count ${liveOnly.steps.length} vs ${mixed.steps.length}`)
        return failures
    }
    for (let index = 0; index < liveOnly.steps.length; index++) {
        const a = liveOnly.steps[index]!
        const b = mixed.steps[index]!
        if (a.op !== b.op) {
            at(`op sequence diverged at ${index}: ${a.op} vs ${b.op}`)
            break
        }
        if (a.result !== b.result) {
            at(`${a.op} result ${a.result} vs ${b.result}`)
            break
        }
        if (a.notified !== b.notified) {
            at(`${a.op} notified [${a.notified}] vs [${b.notified}]`)
            break
        }
        if (a.mounted !== b.mounted) {
            at(`${a.op} mounts [${a.mounted}] vs [${b.mounted}]`)
            break
        }
        if (a.violations.length > 0) {
            at(`${a.op} live-only invariants: ${a.violations}`)
            break
        }
        if (b.violations.length > 0) {
            at(`${a.op} mixed invariants: ${b.violations}`)
            break
        }
        if (a.graph !== b.graph) {
            const left = a.graph.split("\n")
            const right = b.graph.split("\n")
            const row = left.findIndex((line, i) => line !== right[i])
            at(`${a.op} graph: ${left[row]} vs ${right[row]}`)
            break
        }
        // See FLIP: past the flip the two stores hold different cold-cache
        // histories, so only the values above stay comparable.
        const beforeFlip =
            liveOnly.flippedAt === -1 || index < liveOnly.flippedAt
        if (beforeFlip && a.evaluations !== b.evaluations) {
            at(`${a.op} evaluated ${a.evaluations} vs ${b.evaluations}`)
            break
        }
    }
    return failures
}

describe("selector evaluator twin fuzz", () => {
    test("both evaluator twins are observationally identical", () => {
        const SEEDS = 1_500
        const coverage: Coverage = {
            pureLiveOnly: 0,
            sawThrow: 0,
            sawNotification: 0,
            sawSelectorEdges: 0,
            sawMount: 0,
        }
        const failures: string[] = []
        for (let seed = 1; seed <= SEEDS; seed++) {
            failures.push(...compare(seed, coverage))
            // A systemic break would otherwise print thousands of near-identical
            // lines and bury the first one.
            if (failures.length >= 10) break
        }
        expect(failures).toEqual([])

        // Floors, not exact counts: they fail loudly if a change to the op
        // weights drains a path, without pinning the generator's behaviour.
        // Measured headroom at the time of writing, out of 1,500 seeds:
        // pureLiveOnly 701, notifications 744, selector edges 1030,
        // mounts 1119, throws 527.
        expect(coverage.pureLiveOnly).toBeGreaterThan(SEEDS * 0.1)
        expect(coverage.sawNotification).toBeGreaterThan(SEEDS * 0.3)
        expect(coverage.sawSelectorEdges).toBeGreaterThan(SEEDS * 0.3)
        expect(coverage.sawMount).toBeGreaterThan(SEEDS * 0.3)
        expect(coverage.sawThrow).toBeGreaterThan(SEEDS * 0.05)
        // 30s like every sibling fuzz in this directory, and like the V8 lane's
        // own `testTimeout`. Bun's 5s default is not a budget a differential
        // fuzz fits in: ~1.1s locally is ~6s on a CI runner, which is exactly
        // how this first landed red.
    }, 30_000)

    test("a deferred get sees the same disposed store through either twin", () => {
        // The twins' one NAMED difference, and the reason this pairing needed a
        // test rather than a comment: `evaluateSelector`'s deferred-`get` branch
        // opens with an `isStoreDisposed` guard. A deferred `get` is the only
        // way to reach a store after it has been disposed, so whether that
        // guard is present decides whether user code sees an error or a silently
        // successful read of a dead store — and it must not depend on whether
        // the store happened to have cached a cold selector earlier.
        //
        // The selector's return value cannot carry the answer out (reading a
        // disposed store throws at the store boundary, before the value), so the
        // deferred call reports through a closure.
        const observe = (prime: boolean) => {
            const root = store()
            if (prime) root.get(selector(() => 0))
            const source = atom(1)
            const other = atom(10)
            let release: (value: number) => void = () => {}
            const outcome: string[] = []
            const async = selector(get => {
                const first = get(source)
                return new Promise<number>(resolve => {
                    release = waited => {
                        try {
                            resolve(first + waited + get(other))
                            outcome.push("read")
                        } catch (error) {
                            outcome.push((error as Error).constructor.name)
                            resolve(-1)
                        }
                    }
                })
            })
            const unsubscribe = root.sub(async, () => {})
            expect(getStoreData(root).coldSelectorCachesEnabled).toBe(prime)
            unsubscribe()
            root.dispose()
            release(100)
            return outcome
        }
        // Awaiting is unnecessary: `release` runs the deferred `get`
        // synchronously inside the promise executor's closure.
        //
        // Asserted ABSOLUTELY, not just as agreement between the two. A purely
        // differential assertion here would keep passing if the guard were
        // dropped from both twins at once, which is the regression this test
        // exists to stop — so name the required outcome and check the agreement
        // on top of it.
        expect({
            liveOnly: observe(false),
            mixed: observe(true),
        }).toEqual({
            liveOnly: ["StoreDisposedError"],
            mixed: ["StoreDisposedError"],
        })
    })
})
