import { describe, expect, test } from "bun:test"
import { spawnSync } from "node:child_process"
import {
    SelectorCircularDependencyError,
    atom,
    externalAtom,
    selector,
    store,
    type Selector,
    type Store,
} from "../../src/index"

// A selector that catches a cycle error and returns a fallback still reads the
// latch, so it stays on the cycle. Its value says nothing about the cycle's
// topology: it never reopens the latch, while dropping the read always does,
// whether or not its value changes. It is never owned by the cycle's source
// retention, so sources detach with their last subscription and on disposal.
// Independent audit cases N1 (fresh fallback never returned), N2 (sources
// survived unsubscribe and disposal) and E3 (an equal fallback hid the cycle's
// removal) are pinned here across fallback kinds, scopes and retention.

const fallbacks = {
    primitive: () => -1,
    stable: (() => {
        const value = Object.freeze({ fallback: true })
        return () => value
    })(),
    fresh: () => ({ fallback: true }),
} as const
type Fallback = keyof typeof fallbacks
const kinds = Object.keys(fallbacks) as Fallback[]

const outcome = (target: Store, state: Selector<any>): unknown => {
    try {
        return target.get(state)
    } catch (error) {
        let cause = error as { cause?: unknown }
        while (cause.cause !== undefined) cause = cause.cause as typeof cause
        if (cause instanceof SelectorCircularDependencyError)
            return { cycle: cause.selector }
        throw error
    }
}

/** A catches L's error; L reads A while `route` is set. A reads `touch` first
 * and drops L while `breakCycle` is set, returning the same fallback. The
 * guard turns a runaway settlement into a failure instead of a hang. */
const caughtCycle = (fallback: Fallback) => {
    const route = atom(false)
    const breakCycle = atom(false)
    const touch = atom(0)
    const evaluations = { A: 0, L: 0 }
    let L!: Selector<unknown>
    const A: Selector<unknown> = selector(get => {
        if (++evaluations.A > 1_000) throw new Error("runaway settlement")
        get(touch)
        if (get(breakCycle)) return fallbacks[fallback]()
        try {
            return get(L)
        } catch {
            return fallbacks[fallback]()
        }
    })
    L = selector(get => {
        evaluations.L++
        return get(route) ? get(A) : 1
    })
    return { route, breakCycle, touch, evaluations, A, L }
}

const targets = (scoped: boolean) => {
    const root = store()
    return { root, target: scoped ? root.scope() : root }
}

describe("caught cycles settle once", () => {
    for (const fallback of kinds)
        for (const scoped of [false, true])
            for (const subscribed of [false, true])
                test(`${fallback} fallback, ${scoped ? "child scope" : "root"}${subscribed ? ", subscribed" : ""}: closing, persisting and removing the cycle`, () => {
                    const graph = caughtCycle(fallback)
                    const { root, target } = targets(scoped)
                    const notified = { A: 0, L: 0 }
                    expect(target.get(graph.A)).toBe(1)
                    if (subscribed) {
                        target.sub(graph.A, () => notified.A++)
                        target.sub(graph.L, () => notified.L++)
                    }
                    const fresh = fallback === "fresh"
                    // Closing the cycle: each selector evaluates once, as on
                    // beta.46 and in a fresh Store that reads A first.
                    let before = { ...graph.evaluations }
                    target.set(graph.route, true)
                    expect(graph.evaluations.A - before.A).toBe(1)
                    expect(graph.evaluations.L - before.L).toBe(1)
                    expect(outcome(target, graph.A)).toEqual(
                        fallbacks[fallback](),
                    )
                    expect(outcome(target, graph.L)).toEqual({
                        cycle: graph.L,
                    })
                    if (subscribed) expect(notified).toEqual({ A: 1, L: 1 })
                    // A persisting cycle: A re-evaluates along the same
                    // reads; L, its failure and its subscribers are untouched.
                    for (let commit = 1; commit <= 3; commit++) {
                        notified.A = notified.L = 0
                        before = { ...graph.evaluations }
                        target.set(graph.touch, commit)
                        expect(graph.evaluations.A - before.A).toBe(1)
                        expect(graph.evaluations.L - before.L).toBe(0)
                        if (subscribed)
                            expect(notified).toEqual({ A: fresh ? 1 : 0, L: 0 })
                    }
                    // Removing the cycle while A's value stays equal: L
                    // recovers, as in a fresh Store, and notifies once.
                    notified.A = notified.L = 0
                    target.set(graph.breakCycle, true)
                    expect(outcome(target, graph.L)).toEqual(
                        fallbacks[fallback](),
                    )
                    if (subscribed)
                        expect(notified).toEqual({ A: fresh ? 1 : 0, L: 1 })
                    const reference = caughtCycle(fallback)
                    const clean = store()
                    clean.set(reference.route, true)
                    clean.set(reference.breakCycle, true)
                    expect(outcome(clean, reference.L)).toEqual(
                        outcome(target, graph.L),
                    )
                    clean.dispose()
                    root.dispose()
                })

    test("the audit's unguarded fresh-fallback reproduction returns (child process, 5 s limit)", () => {
        // Unchanged from the audit (tests/nontermination.mjs) apart from the
        // import; the parent kills it if Store.set never returns.
        if (typeof Bun === "undefined") return
        const source = `
            const {atom,selector,store}=await import(${JSON.stringify(new URL("../../src/index.ts", import.meta.url).pathname)});
            const route=atom(false);let L,evaluations=0;
            const A=selector(get=>{evaluations++;try{return get(L)}catch{return {fallback:true}}},{name:'A'});
            L=selector(get=>get(route)?get(A):1,{name:'L'});
            const s=store();s.get(A);s.set(route,true);
            console.log(JSON.stringify({returned:true,evaluations}));s.dispose();`
        const child = spawnSync(process.execPath, ["-e", source], {
            timeout: 5_000,
            encoding: "utf8",
        })
        expect(child.error?.message, child.stderr).toBeUndefined()
        expect(child.status, child.stderr).toBe(0)
        expect(JSON.parse(child.stdout.trim())).toEqual({
            returned: true,
            evaluations: 2,
        })
    })
})

/** One caught cycle whose catching selector also reads an external source. */
const sourcedCycle = (fallback: Fallback) => {
    let snapshot = 0
    const listeners = new Set<() => void>()
    const counts = { starts: 0, cleanups: 0, duplicates: 0 }
    const source = externalAtom({
        getSnapshot: () => snapshot,
        subscribe: notify => {
            counts.starts++
            listeners.add(notify)
            let cleaned = false
            return () => {
                if (cleaned) counts.duplicates++
                cleaned = true
                counts.cleanups++
                listeners.delete(notify)
            }
        },
    })
    const route = atom(false)
    let evaluations = 0
    let L!: Selector<unknown>
    const A: Selector<unknown> = selector(get => {
        if (++evaluations > 1_000) throw new Error("runaway settlement")
        get(source)
        try {
            return get(L)
        } catch {
            return fallbacks[fallback]()
        }
    })
    L = selector(get => (get(route) ? get(A) : 1))
    const dependent = selector(get => [get(L)])
    const write = () => {
        snapshot++
        for (const notify of [...listeners]) notify()
    }
    return { listeners, counts, route, A, L, dependent, write }
}

describe("caught-cycle source ownership", () => {
    for (const fallback of ["primitive", "fresh"] as const)
        for (const scoped of [false, true])
            for (const subscriber of ["latch", "catcher", "dependent"] as const)
                test(`${fallback} fallback, ${scoped ? "child scope" : "root"}, subscribed ${subscriber}: attached exactly while observed`, () => {
                    const cycle = sourcedCycle(fallback)
                    const { root, target } = targets(scoped)
                    target.get(cycle.A)
                    target.set(cycle.route, true)
                    const state: Selector<any> =
                        subscriber === "latch"
                            ? cycle.L
                            : subscriber === "catcher"
                              ? cycle.A
                              : cycle.dependent
                    expect(cycle.listeners.size).toBe(0)
                    for (let round = 1; round <= 3; round++) {
                        const stop = target.sub(state, () => {})
                        expect(cycle.listeners.size).toBe(1)
                        cycle.write()
                        expect(outcome(target, cycle.L)).toEqual({
                            cycle: cycle.L,
                        })
                        stop()
                        expect(cycle.listeners.size).toBe(0)
                        expect(cycle.counts.cleanups).toBe(round)
                    }
                    // Disposal with a live subscription releases it once, and
                    // the disposed Store no longer hears the source.
                    target.sub(state, () => {})
                    expect(cycle.listeners.size).toBe(1)
                    target.dispose()
                    root.dispose()
                    expect(cycle.listeners.size).toBe(0)
                    expect(cycle.counts).toEqual({
                        starts: 4,
                        cleanups: 4,
                        duplicates: 0,
                    })
                })

    for (const scoped of [false, true])
        test(`independent caught cycles never accumulate sources (${scoped ? "child scope" : "root"})`, () => {
            const { root, target } = targets(scoped)
            const cycles = Array.from({ length: 4 }, () =>
                sourcedCycle("fresh"),
            )
            const stops = cycles.map(cycle => {
                target.get(cycle.A)
                target.set(cycle.route, true)
                return target.sub(cycle.L, () => {})
            })
            expect(cycles.map(cycle => cycle.listeners.size)).toEqual([
                1, 1, 1, 1,
            ])
            stops.forEach(stop => stop())
            expect(cycles.map(cycle => cycle.listeners.size)).toEqual([
                0, 0, 0, 0,
            ])
            for (const cycle of cycles) target.sub(cycle.A, () => {})
            target.dispose()
            root.dispose()
            for (const cycle of cycles)
                expect(cycle.counts).toEqual({
                    starts: 2,
                    cleanups: 2,
                    duplicates: 0,
                })
        })
})

describe("a cycle's route versus its reads", () => {
    test("a member that moves its read to another route re-derives the latch", () => {
        const route = atom(false)
        const useX = atom(true)
        let L!: Selector<number>
        const X: Selector<number> = selector(get => get(L) + 1, { name: "X" })
        const Y: Selector<number> = selector(get => get(L) + 2, { name: "Y" })
        const M: Selector<number> = selector(
            get => (get(useX) ? get(X) : get(Y)),
            { name: "M" },
        )
        L = selector(get => (get(route) ? get(M) : 0), { name: "L" })
        const target = store()
        target.get(X)
        target.get(Y)
        target.get(M)
        const path = (): unknown => {
            try {
                target.get(L)
            } catch (error) {
                let cause = error as { cause?: unknown }
                while (cause.cause !== undefined)
                    cause = cause.cause as typeof cause
                const cycle = cause as SelectorCircularDependencyError
                const labels = new Map<unknown, string>([
                    [L, "L"],
                    [M, "M"],
                    [X, "X"],
                    [Y, "Y"],
                ])
                return cycle.path.map(state => labels.get(state))
            }
        }
        target.set(route, true)
        expect(path()).toEqual(["L", "M", "X", "L"])
        // M now reads Y instead of X. The cycle persists through Y, but the
        // reported edge M -> X is gone, so L re-derives its failure.
        target.set(useX, false)
        expect(path()).toEqual(["L", "M", "Y", "L"])
        target.dispose()
    })

    test("a member that fails earlier along its reads keeps the latch and its blame", () => {
        // selector-graph-semantics counterexample for an edge-precise watch:
        // n1 -> n4 closes n1 -> n4 -> n3 -> n1; n3 then fails at n0 before
        // reading n1, which leaves n3 -> n1 unobserved, not removed.
        const graph = [[1], [], [1, 3], [0, 1], [2, 3]]
        const gate = atom(-1)
        const evaluations = graph.map(() => 0)
        const nodes: Selector<number>[] = []
        graph.forEach((edges, index) =>
            nodes.push(
                selector(get => {
                    evaluations[index]!++
                    let sum = 1
                    for (const edge of edges) sum += get(nodes[edge]!)
                    if (index === 1 && get(gate) >= 0)
                        sum += get(nodes[get(gate)]!)
                    return sum
                }),
            ),
        )
        const target = store()
        for (const node of nodes) target.get(node)
        const before = evaluations[1]!
        target.set(gate, 4)
        let error: unknown
        try {
            target.get(nodes[1]!)
        } catch (thrown) {
            error = thrown
        }
        expect(error).toBeInstanceOf(SelectorCircularDependencyError)
        expect((error as SelectorCircularDependencyError).selector).toBe(
            nodes[1],
        )
        expect(evaluations[1]! - before).toBe(1)
        target.dispose()
    })
})

/** The audit's cold-read shape: the cycle closes during the first read. A
 * reads the source; while it says "L", A reads L and catches its error. L
 * reads A while `route` is "A". Breaking the cycle through the source returns
 * `broken`, or the same fallback for an unchanged-value recovery. */
const coldCycle = (
    source: ReturnType<typeof sharedSource>["source"],
    recovery: "changed" | "unchanged",
) => {
    const route = atom<"A" | "leaf">("A")
    let evaluations = 0
    let L!: Selector<number>
    const A: Selector<number> = selector(get => {
        if (++evaluations > 1_000) throw new Error("runaway settlement")
        if (get(source).cycle === false) return recovery === "changed" ? 10 : -1
        try {
            return get(L)
        } catch {
            return -1
        }
    })
    L = selector(get => (get(route) === "A" ? get(A) : 0))
    const dependent = selector(get => get(L) + 100)
    return { route, A, L, dependent }
}

const sharedSource = () => {
    let snapshot = { cycle: true }
    const listeners = new Set<() => void>()
    const counts = { starts: 0, cleanups: 0, duplicates: 0 }
    const source = externalAtom({
        getSnapshot: () => snapshot,
        subscribe: notify => {
            counts.starts++
            listeners.add(notify)
            let cleaned = false
            return () => {
                if (cleaned) counts.duplicates++
                cleaned = true
                counts.cleanups++
                listeners.delete(notify)
            }
        },
    })
    const write = (cycle: boolean) => {
        snapshot = { cycle }
        for (const notify of [...listeners]) notify()
    }
    return { source, listeners, counts, write }
}

describe("cycles that close during a cold read", () => {
    for (const first of ["catcher", "latch"] as const)
        for (const subscriber of ["latch", "dependent"] as const)
            for (const scoped of [false, true])
                for (const recovery of ["changed", "unchanged"] as const)
                    test(`${first} read first, subscribed ${subscriber}, ${scoped ? "child scope" : "root"}, ${recovery} catcher value: the source breaks the cycle and notifies`, () => {
                        const shared = sharedSource()
                        const cycle = coldCycle(shared.source, recovery)
                        const { root, target } = targets(scoped)
                        try {
                            target.get(first === "catcher" ? cycle.A : cycle.L)
                        } catch {}
                        const state =
                            subscriber === "latch" ? cycle.L : cycle.dependent
                        const seen: unknown[] = []
                        const stop = target.sub(state, () =>
                            seen.push(outcome(target, state)),
                        )
                        // The latch reaches the source through the catcher it
                        // watches, whichever selector the read reached first.
                        expect(shared.listeners.size).toBe(1)
                        shared.write(false)
                        const recovered = recovery === "changed" ? 10 : -1
                        expect(seen).toEqual([
                            subscriber === "latch"
                                ? recovered
                                : recovered + 100,
                        ])
                        stop()
                        expect(shared.listeners.size).toBe(0)
                        target.sub(state, () => {})
                        target.dispose()
                        root.dispose()
                        expect(shared.listeners.size).toBe(0)
                        expect(shared.counts).toEqual({
                            starts: 2,
                            cleanups: 2,
                            duplicates: 0,
                        })
                    })

    for (const scoped of [false, true])
        test(`a dormant latch read after a cold catcher-first read re-samples its cycle's source (${scoped ? "child scope" : "root"})`, () => {
            const shared = sharedSource()
            const cycle = coldCycle(shared.source, "unchanged")
            const { root, target } = targets(scoped)
            target.get(cycle.A)
            expect(outcome(target, cycle.L)).toEqual({ cycle: cycle.L })
            shared.write(false)
            // No read of the catcher first: the latch's own read finds it.
            expect(outcome(target, cycle.L)).toBe(-1)
            root.dispose()
        })

    test("cycles sharing a source attach it once and release it with the last subscription or disposal", () => {
        const shared = sharedSource()
        const first = coldCycle(shared.source, "changed")
        const second = coldCycle(shared.source, "unchanged")
        const target = store()
        target.get(first.A)
        target.get(second.A)
        const seen: unknown[] = []
        const stops = [
            target.sub(first.L, () => seen.push(outcome(target, first.L))),
            target.sub(second.dependent, () =>
                seen.push(outcome(target, second.dependent)),
            ),
        ]
        expect(shared.listeners.size).toBe(1)
        shared.write(false)
        expect(seen.sort()).toEqual([10, 99])
        shared.write(true)
        stops[0]!()
        expect(shared.listeners.size).toBe(1)
        stops[1]!()
        expect(shared.listeners.size).toBe(0)
        target.sub(first.dependent, () => {})
        target.sub(second.L, () => {})
        expect(shared.listeners.size).toBe(1)
        target.dispose()
        expect(shared.listeners.size).toBe(0)
        expect(shared.counts).toEqual({
            starts: 2,
            cleanups: 2,
            duplicates: 0,
        })
    })
})
