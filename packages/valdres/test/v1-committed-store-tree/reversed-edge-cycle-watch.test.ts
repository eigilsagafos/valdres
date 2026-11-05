import { describe, expect, test } from "bun:test"
import { spawnSync } from "node:child_process"
import { sourcedGraph, type Graph } from "./reversed-edge-graph.harness"
import {
    SelectorCircularDependencyError,
    atom,
    externalAtom,
    family,
    selector,
    store,
    type Selector,
    type Store,
} from "../../src/index"

// A selector that reports a real cycle records only the reads before the one
// that closed it, so it watches the other selectors on that cycle instead. Its
// failure holds while its closing read still reaches it: a watched selector
// that stops reading its successor reopens it, and one that republishes any
// value or failure along the same reads never does. While retained, it keeps
// the external sources its cycle reads attached. These tests pin the watch's
// lifetime, isolation, retention and bounds.

const cycleOwner = (target: Store, state: Selector<any>): unknown => {
    try {
        target.get(state)
    } catch (error) {
        let cause = error as { cause?: unknown }
        while (cause.cause !== undefined) cause = cause.cause as typeof cause
        if (cause instanceof SelectorCircularDependencyError)
            return cause.selector
        throw error
    }
    return undefined
}

/** L reads `route`'s target; A and B read L back while their row is "L". */
const latchGraph = () => {
    const route = atom<"A" | "B" | "root">("root")
    const rowA = atom<"L" | "root">("L")
    const rowB = atom<"L" | "root">("L")
    const touch = atom(0)
    const evaluations = { L: 0, A: 0, B: 0 }
    let L!: Selector<number>
    const A: Selector<number> = selector(get => {
        evaluations.A++
        get(touch)
        return get(rowA) === "L" ? get(L) + 1 : 10
    })
    const B: Selector<number> = selector(get => {
        evaluations.B++
        return get(rowB) === "L" ? get(L) + 1 : 20
    })
    L = selector(get => {
        evaluations.L++
        const target = get(route)
        return target === "root" ? 1 : get(target === "A" ? A : B) + 1
    })
    return { route, rowA, rowB, touch, evaluations, L, A, B }
}

/** Caches A -> L and B -> L, then routes L into A so that L latches. */
const latched = (target: Store, graph: ReturnType<typeof latchGraph>) => {
    target.get(graph.A)
    target.get(graph.B)
    target.set(graph.route, "A")
    expect(cycleOwner(target, graph.L)).toBe(graph.L)
}

describe("cycle watch lifetime", () => {
    test("a latch that recovers through its own read drops its watch", () => {
        const graph = latchGraph()
        const target = store()
        latched(target, graph)
        target.set(graph.route, "root")
        expect(target.get(graph.L)).toBe(1)
        const evaluations = graph.evaluations.L
        // A was on L's old cycle; L no longer reads it.
        target.set(graph.rowA, "root")
        expect(target.get(graph.A)).toBe(10)
        expect(graph.evaluations.L).toBe(evaluations)
        target.dispose()
    })

    test("a latch that reports a different cycle replaces its watch", () => {
        const graph = latchGraph()
        const target = store()
        latched(target, graph)
        target.set(graph.route, "B")
        expect(cycleOwner(target, graph.L)).toBe(graph.L)
        const evaluations = graph.evaluations.L
        // A left L's cycle: its recovery is unrelated to L now.
        target.set(graph.rowA, "root")
        expect(graph.evaluations.L).toBe(evaluations)
        expect(cycleOwner(target, graph.L)).toBe(graph.L)
        // B is on the reported cycle: its recovery reopens L.
        target.set(graph.rowB, "root")
        expect(target.get(graph.L)).toBe(21)
        target.dispose()
    })
})

describe("cycle watch isolation", () => {
    test("another Store's publications never reopen a latch", () => {
        const graph = latchGraph()
        const first = store()
        const second = store()
        latched(first, graph)
        second.set(graph.rowA, "root")
        expect(second.get(graph.A)).toBe(10)
        const evaluations = graph.evaluations.L
        second.set(graph.touch, 1)
        expect(second.get(graph.A)).toBe(10)
        expect(graph.evaluations.L).toBe(evaluations)
        expect(cycleOwner(first, graph.L)).toBe(graph.L)
        first.dispose()
        second.dispose()
    })

    test("a sibling scope's publications never reopen a latch", () => {
        const graph = latchGraph()
        const root = store()
        const latchedScope = root.scope()
        const sibling = root.scope()
        latchedScope.get(graph.A)
        root.txn(transaction =>
            transaction.scope(latchedScope).set(graph.route, "A"),
        )
        expect(cycleOwner(latchedScope, graph.L)).toBe(graph.L)
        sibling.get(graph.A)
        const evaluations = graph.evaluations.L
        root.txn(transaction =>
            transaction.scope(sibling).set(graph.rowA, "root"),
        )
        expect(sibling.get(graph.A)).toBe(10)
        expect(graph.evaluations.L).toBe(evaluations)
        expect(cycleOwner(latchedScope, graph.L)).toBe(graph.L)
        root.dispose()
    })
})

describe("cycle watch within one settlement", () => {
    test("a member that fails again and then leaves the cycle in one settlement reopens the latch", () => {
        const graph = latchGraph()
        const target = store()
        latched(target, graph)
        const seen: number[] = []
        const stopL = target.sub(graph.L, () => seen.push(target.get(graph.L)))
        const trigger = atom(0)
        // `touch` republishes A as another failure along the same reads, which
        // leaves L latched. The settle handler then breaks the cycle at A
        // inside the same settlement.
        const stop = target.sub(trigger, {
            settle: transaction => transaction.set(graph.rowA, "root"),
        })
        target.txn(transaction => {
            transaction.set(graph.touch, 1)
            transaction.set(trigger, 1)
        })
        expect(target.get(graph.A)).toBe(10)
        expect(target.get(graph.L)).toBe(11)
        expect(seen).toEqual([11])
        stop()
        stopL()
        target.dispose()
    })

    test("a persisting cycle never re-evaluates its latch", () => {
        const graph = latchGraph()
        const target = store()
        latched(target, graph)
        const notified = { L: 0, A: 0 }
        const stops = [
            target.sub(graph.L, () => notified.L++),
            target.sub(graph.A, () => notified.A++),
        ]
        const trigger = atom(0)
        let handled = 0
        // Each settle handler commit republishes A again inside the boundary.
        const stop = target.sub(trigger, {
            settle: transaction => {
                if (handled++ < 3) transaction.set(graph.touch, 100 + handled)
            },
        })
        for (let commit = 1; commit <= 4; commit++) {
            notified.L = notified.A = 0
            handled = 0
            const evaluations = graph.evaluations.L
            target.txn(transaction => {
                transaction.set(graph.touch, commit)
                transaction.set(trigger, commit)
            })
            expect(cycleOwner(target, graph.L)).toBe(graph.L)
            // A still reads L, so the cycle and L's failure are unchanged.
            expect(graph.evaluations.L - evaluations).toBe(0)
            expect(notified.L).toBe(0)
            expect(notified.A).toBeLessThanOrEqual(1)
        }
        target.set(graph.rowA, "root")
        expect(target.get(graph.L)).toBe(11)
        stop()
        stops.forEach(stop => stop())
        target.dispose()
    })

    for (const retention of [
        "latch subscribed",
        "source live",
        "dormant",
    ] as const)
        test(`external-source settlement keeps a persisting cycle bounded, then recovers (${retention})`, () => {
            type Rows = { readonly A: "L" | "root"; readonly touch: number }
            let rows: Rows = { A: "L", touch: 0 }
            const listeners = new Set<() => void>()
            const source = externalAtom<Rows>({
                getSnapshot: () => rows,
                subscribe: notify => {
                    listeners.add(notify)
                    return () => listeners.delete(notify)
                },
            })
            const route = atom<"A" | "root">("root")
            let evaluationsL = 0
            let L!: Selector<number>
            const A: Selector<number> = selector(get => {
                const snapshot = get(source)
                return snapshot.A === "L" ? get(L) + 1 : 10 + snapshot.touch
            })
            L = selector(get => {
                evaluationsL++
                return get(route) === "A" ? get(A) + 1 : 1
            })
            const target = store()
            const notifiedL: unknown[] = []
            // Only the latch reaches the source through its watch when it alone
            // is subscribed; a dormant source is re-sampled by reads.
            const stop =
                retention === "latch subscribed"
                    ? target.sub(L, () =>
                          notifiedL.push(
                              cycleOwner(target, L) ?? target.get(L),
                          ),
                      )
                    : retention === "source live"
                      ? target.sub(source, () => {})
                      : () => {}
            target.get(A)
            target.set(route, "A")
            expect(cycleOwner(target, L)).toBe(L)
            expect(listeners.size).toBe(retention === "dormant" ? 0 : 1)
            for (let notify = 1; notify <= 4; notify++) {
                notifiedL.length = 0
                const evaluations = evaluationsL
                rows = { A: "L", touch: notify }
                for (const listener of [...listeners]) listener()
                expect(cycleOwner(target, L)).toBe(L)
                expect(evaluationsL - evaluations).toBe(0)
                expect(notifiedL.length).toBe(0)
            }
            notifiedL.length = 0
            rows = { A: "root", touch: 5 }
            for (const listener of [...listeners]) listener()
            expect(target.get(L)).toBe(16)
            if (retention === "latch subscribed")
                expect(notifiedL).toEqual([16])
            stop()
            target.dispose()
        })
})

describe("cycle watch source retention", () => {
    /** L latches on L -> A -> L; A alone reads the external source. */
    const sourceCycle = () => {
        let rows = { A: "L" as "L" | "root", touch: 0 }
        const listeners = new Set<() => void>()
        const source = externalAtom({
            getSnapshot: () => rows,
            subscribe: notify => {
                listeners.add(notify)
                return () => listeners.delete(notify)
            },
        })
        const route = atom<"A" | "root">("root")
        let L!: Selector<number>
        const A: Selector<number> = selector(get => {
            const snapshot = get(source)
            return snapshot.A === "L" ? get(L) + 1 : 10 + snapshot.touch
        })
        L = selector(get => (get(route) === "A" ? get(A) + 1 : 1))
        const dependent = selector(get => get(L) * 2)
        const write = (next: typeof rows) => {
            rows = next
            for (const notify of [...listeners]) notify()
        }
        return { listeners, route, A, L, dependent, write }
    }

    for (const subscriber of ["latch", "member", "dependent"] as const)
        test(`a subscribed ${subscriber} keeps the cycle's source attached exactly while subscribed`, () => {
            const graph = sourceCycle()
            const target = store()
            target.get(graph.A)
            target.set(graph.route, "A")
            expect(cycleOwner(target, graph.L)).toBe(graph.L)
            const state =
                subscriber === "latch"
                    ? graph.L
                    : subscriber === "member"
                      ? graph.A
                      : graph.dependent
            const stop = target.sub(state, () => {})
            expect(graph.listeners.size).toBe(1)
            graph.write({ A: "L", touch: 1 })
            expect(cycleOwner(target, graph.L)).toBe(graph.L)
            stop()
            // The latch's walk retains no failing selector, so nothing on the
            // cycle can keep itself attached.
            expect(graph.listeners.size).toBe(0)
            target.sub(state, () => {})
            expect(graph.listeners.size).toBe(1)
            target.dispose()
            expect(graph.listeners.size).toBe(0)
        })

    for (const subscriber of ["latch", "dependent"] as const)
        test(`a source write that breaks the cycle notifies a subscribed ${subscriber}`, () => {
            const graph = sourceCycle()
            const target = store()
            target.get(graph.A)
            target.set(graph.route, "A")
            const state = subscriber === "latch" ? graph.L : graph.dependent
            const seen: unknown[] = []
            target.sub(state, () =>
                seen.push(cycleOwner(target, state) ?? target.get(state)),
            )
            graph.write({ A: "root", touch: 5 })
            expect(seen).toEqual([subscriber === "latch" ? 16 : 32])
            target.dispose()
        })

    test("a release through a recorded cycle keeps a subscribed branch attached", () => {
        // Differential harness, dormant external rows, seed 302179 (minimized):
        // n3 -> n0 -> n4 -> n3 is a real cycle; the next commit moves n3 off it,
        // and releasing n0 reaches n4's record while n4 is being reconciled.
        const graph = sourcedGraph(5, "external", [true])
        const commits: Graph[] = [
            [[], [], [], [], []],
            [[4], [], [0], [4], []],
            [[4], [], [3], [0], [3]],
            [[], [], [4], [], [2]],
            [[], [], [], [2], []],
        ]
        const target = store()
        const seen: string[] = []
        target.sub(graph.node(3), () => {
            try {
                seen.push(target.get(graph.node(3)))
            } catch {
                seen.push("error")
            }
        })
        target.get(graph.node(2))
        for (const next of commits) graph.commit(target, next)
        expect(seen.at(-1)).toBe("n3[n2[]]")
        target.dispose()
    })
})

/** Runs a GC-sensitive check in a fresh process, like external-retention. */
function retentionTest(name: string, check: () => Promise<void>): void {
    // The checks need Bun's collector; portable runners skip them.
    if (typeof Bun === "undefined") return
    test(name, async () => {
        if (process.env.VALDRES_CYCLE_WATCH_RETENTION_CHILD === "1") {
            await check()
            console.log(`CYCLE_WATCH_RETENTION_PASS:${name}`)
            return
        }
        const child = spawnSync(
            process.execPath,
            ["test", import.meta.path, "--test-name-pattern", `^${name}$`],
            {
                env: {
                    ...process.env,
                    VALDRES_CYCLE_WATCH_RETENTION_CHILD: "1",
                },
                timeout: 5_000,
                encoding: "utf8",
            },
        )
        expect(child.status, child.error?.message ?? child.stderr).toBe(0)
        expect(child.stdout.split("\n")).toContain(
            `CYCLE_WATCH_RETENTION_PASS:${name}`,
        )
    })
}

async function retained(reference: WeakRef<object>): Promise<boolean> {
    for (let round = 0; round < 20; round++) {
        await new Promise<void>(resolve => setTimeout(resolve, 0))
        Bun.gc(true)
        if (reference.deref() === undefined) return false
    }
    return true
}

// Retention checks run at top level so the child process can select them.
for (const owner of ["Store", "scope"] as const)
    retentionTest(
        `disposing the ${owner} releases the selectors a latch watches`,
        async () => {
            const route = atom(false)
            const key = atom("member")
            let L!: Selector<number>
            // The member is reachable only through the family's weak cache.
            const members = family((name: string) =>
                selector(get => get(L) + name.length),
            )
            L = selector(get => (get(route) ? get(members(get(key))) + 1 : 1))
            const root = store()
            const target = owner === "Store" ? root : root.scope()
            const member = (() => {
                const node = members("member")
                target.get(node)
                return new WeakRef(node)
            })()
            target.txn(transaction => transaction.set(route, true))
            expect(cycleOwner(target, L)).toBe(L)
            // While the latch is live, its watch keeps the member.
            expect(await retained(member)).toBe(true)
            target.dispose()
            expect(await retained(member)).toBe(false)
            root.dispose()
        },
    )
