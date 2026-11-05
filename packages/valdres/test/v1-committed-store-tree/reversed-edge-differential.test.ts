import { describe, expect, test } from "bun:test"
import { store, type Store } from "../../src/index"
import {
    CYCLE,
    expand,
    freshValues,
    graphStates,
    random,
    randomDag,
    settle,
    shuffle,
    type Graph,
    type GraphStates,
} from "./reversed-edge-graph.harness"

// A bounded seeded differential over committed graph rewrites. Each case
// caches part of a random DAG, then commits rewrites under random topological
// orders, so dependencies reverse between cached selectors. Every read,
// subscriber delivery and final value must equal both an independent
// expansion of the committed graph and a fresh Store. The cyclic control
// keeps real cycle detection in scope: a fix cannot pass by not detecting.

type Kind = "root" | "inherited" | "owned"
const kinds: readonly Kind[] = ["root", "inherited", "owned"]

const nodes = (size: number): number[] => [...Array(size).keys()]

class Subject {
    readonly states: GraphStates
    readonly root = store()
    readonly target: Store
    readonly #owner: Store | undefined

    constructor(
        size: number,
        kind: Kind,
        throughComparator: readonly boolean[],
        initial: Graph,
        next: () => number,
    ) {
        this.states = graphStates(size, throughComparator)
        this.target = kind === "root" ? this.root : this.root.scope()
        this.#owner = kind === "owned" ? this.target : undefined
        // An owned graph shadows a different inherited one.
        if (kind === "owned")
            this.root.txn(transaction =>
                randomDag(size, next).forEach((row, node) =>
                    transaction.set(this.states.row(node), row),
                ),
            )
        this.commit(initial, nodes(size))
    }

    commit(graph: Graph, order: readonly number[], rollback?: Error): void {
        this.root.txn(transaction => {
            const writer =
                this.#owner === undefined
                    ? transaction
                    : transaction.scope(this.#owner)
            for (const node of order)
                writer.set(this.states.row(node), graph[node]!)
            if (rollback !== undefined) throw rollback
        })
    }

    read(node: number): string {
        return settle(this.target, this.states.node(node))
    }
}

const rewrite = (
    previous: Graph,
    next: () => number,
): { graph: number[][]; order: number[] } => {
    const fresh = randomDag(previous.length, next)
    const order = shuffle(nodes(previous.length), next)
    // Some rows keep their edges: as an equal copy, or the same array.
    const graph = previous.map((row, node) => {
        const roll = next()
        return roll < 0.1
            ? [...row]
            : roll < 0.15
              ? (row as number[])
              : fresh[node]!
    })
    // Kept rows can close a cycle with the new ones; this lane stays acyclic.
    return { graph: expand(graph).includes(CYCLE) ? fresh : graph, order }
}

const reaches = (graph: Graph, from: number, to: number): boolean => {
    const seen = new Set<number>()
    const pending = [from]
    while (pending.length > 0) {
        const node = pending.pop()!
        for (const dependency of graph[node]!) {
            if (dependency === to) return true
            if (seen.has(dependency)) continue
            seen.add(dependency)
            pending.push(dependency)
        }
    }
    return false
}

describe("committed reversal differential", () => {
    for (const size of [5, 7, 9])
        test(`acyclic rewrites of ${size} selectors agree with a fresh Store`, () => {
            for (let seed = 1; seed <= 250; seed++) {
                const next = random(seed * 7919 + size)
                const kind = kinds[seed % kinds.length]!
                const throughComparator = nodes(size).map(() => next() < 0.5)
                let graph: Graph = randomDag(size, next)
                const subject = new Subject(
                    size,
                    kind,
                    throughComparator,
                    graph,
                    next,
                )
                // A subscriber reads its own selector when notified.
                const delivered = new Map<number, string>()
                const stops = nodes(size)
                    .filter(() => next() < 0.3)
                    .map(node =>
                        subject.target.sub(subject.states.node(node), () => {
                            delivered.set(node, subject.read(node))
                        }),
                    )
                for (let step = 0; step < 5; step++) {
                    const cached = expand(graph)
                    for (const node of shuffle(nodes(size), next))
                        if (next() < 0.6)
                            expect({
                                seed,
                                step,
                                node,
                                read: subject.read(node),
                            }).toEqual({
                                seed,
                                step,
                                node,
                                read: cached[node]!,
                            })
                    const { graph: rewritten, order } = rewrite(graph, next)
                    delivered.clear()
                    if (next() < 0.1) {
                        const rollback = new Error("rollback")
                        expect(() =>
                            subject.commit(rewritten, order, rollback),
                        ).toThrow(rollback)
                    } else {
                        subject.commit(rewritten, order)
                        graph = rewritten
                    }
                    const committed = expand(graph)
                    for (const [node, value] of delivered)
                        expect({ seed, step, node, delivered: value }).toEqual({
                            seed,
                            step,
                            node,
                            delivered: committed[node]!,
                        })
                }
                const expected = expand(graph)
                expect(freshValues(graph)).toEqual(expected)
                expect({
                    seed,
                    final: nodes(size).map(node => subject.read(node)),
                }).toEqual({
                    seed,
                    final: expected,
                })
                stops.forEach(stop => stop())
                subject.root.dispose()
            }
        })

    test("real cycles are still reported, and every selector recovers", () => {
        for (let seed = 1; seed <= 300; seed++) {
            const next = random(seed * 104729)
            const size = 4 + (seed % 4)
            const kind = kinds[seed % kinds.length]!
            // Direct row reads: a commit that rewrites every row dirties every
            // selector, including one whose latched cycle recorded no closing
            // edge.
            const subject = new Subject(
                size,
                kind,
                [],
                randomDag(size, next),
                next,
            )
            for (const node of nodes(size)) if (next() < 0.7) subject.read(node)
            // A reversal that also adds an edge back along one of its paths.
            const { graph: rewritten, order } = rewrite(
                nodes(size).map(() => []),
                next,
            )
            const from = Math.floor(next() * size)
            const targets = nodes(size).filter(node =>
                reaches(rewritten, from, node),
            )
            const to =
                targets.length === 0
                    ? from
                    : targets[Math.floor(next() * targets.length)]!
            const cyclic = rewritten.map(row => [...row])
            cyclic[to]!.push(from)
            subject.commit(cyclic, order)
            const expected = expand(cyclic)
            expect(expected).toContain(CYCLE)
            expect(freshValues(cyclic)).toEqual(expected)
            expect({
                seed,
                cyclic: nodes(size).map(node => subject.read(node)),
            }).toEqual({
                seed,
                cyclic: expected,
            })
            const recovered = randomDag(size, next)
            subject.commit(recovered, shuffle(nodes(size), next))
            expect({
                seed,
                recovered: nodes(size).map(node => subject.read(node)),
            }).toEqual({
                seed,
                recovered: expand(recovered),
            })
            subject.root.dispose()
        }
    })

    test("a latched cycle recovers through comparator rows, kept rows and scopes", () => {
        for (let seed = 1; seed <= 300; seed++) {
            const next = random(seed * 6151)
            const size = 4 + (seed % 4)
            const kind = kinds[seed % kinds.length]!
            // Rows read through a comparator keep a latched selector clean
            // unless the cycle it reported reopens it.
            const throughComparator = nodes(size).map(() => next() < 0.6)
            let graph: Graph = randomDag(size, next)
            const subject = new Subject(
                size,
                kind,
                throughComparator,
                graph,
                next,
            )
            const stops = nodes(size)
                .filter(() => next() < 0.3)
                .map(node =>
                    subject.target.sub(subject.states.node(node), () => {}),
                )
            for (const node of nodes(size)) if (next() < 0.7) subject.read(node)
            const cycles = 1 + Math.floor(next() * 2)
            for (let round = 0; round < cycles; round++) {
                const from = Math.floor(next() * size)
                const targets = nodes(size).filter(node =>
                    reaches(graph, from, node),
                )
                const to =
                    targets.length === 0
                        ? from
                        : targets[Math.floor(next() * targets.length)]!
                const cyclic = graph.map(row => [...row])
                cyclic[to]!.push(from)
                subject.commit(cyclic, shuffle(nodes(size), next))
                expect({
                    seed,
                    round,
                    cyclic: nodes(size).map(node => subject.read(node)),
                }).toEqual({
                    seed,
                    round,
                    cyclic: expand(cyclic),
                })
                graph = cyclic
            }
            const { graph: recovered, order } = rewrite(graph, next)
            const acyclic = expand(recovered).includes(CYCLE)
                ? randomDag(size, next)
                : recovered
            subject.commit(acyclic, order)
            expect({
                seed,
                recovered: nodes(size).map(node => subject.read(node)),
            }).toEqual({
                seed,
                recovered: expand(acyclic),
            })
            stops.forEach(stop => stop())
            subject.root.dispose()
        }
    })
})
