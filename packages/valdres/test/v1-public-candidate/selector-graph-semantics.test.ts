import { describe, expect, test } from "bun:test"
import {
    SelectorCircularDependencyError,
    atom,
    selector,
    store,
    type Atom,
    type Selector,
    type Store,
} from "../../src/index"
import {
    createSelectorOracle,
    type SelectorOracleDefinition,
} from "../v1-model/selector-oracle"

// Product-level selector graph semantics exercised through the public v1
// root. These cases were ported from the retired selector-kernel tournament
// corpus; they assert directly against the current source, with independent
// expectations (a Boolean transitive closure and the symbolic selector
// oracle) instead of recorded evidence.

type Adjacency = readonly (readonly number[])[]

const capture = (
    operation: () => unknown,
): { value?: unknown; error?: unknown } => {
    try {
        return { value: operation() }
    } catch (error) {
        return { error }
    }
}

const causes = (error: unknown): unknown[] => {
    const chain: unknown[] = []
    let current: unknown = error
    while (current !== undefined && !chain.includes(current)) {
        chain.push(current)
        current = (current as { cause?: unknown })?.cause
    }
    return chain
}

const errorNames = (error: unknown): string[] =>
    causes(error).map(entry => (entry as { name?: string })?.name ?? "")

const failure = (operation: () => unknown, name: string): unknown => {
    const result = capture(operation)
    if (!("error" in result)) {
        throw new Error(`expected ${name}, but the operation succeeded`)
    }
    expect(errorNames(result.error)).toContain(name)
    return result.error
}

const circular = (error: unknown): SelectorCircularDependencyError => {
    const cause = causes(error).find(
        entry => entry instanceof SelectorCircularDependencyError,
    )
    if (cause === undefined) {
        throw new Error(
            `expected an exported SelectorCircularDependencyError in ${errorNames(error).join(" -> ")}`,
        )
    }
    return cause as SelectorCircularDependencyError
}

// Independent Boolean transitive closure: neither the production cycle search
// nor the selector oracle's DFS participates in this edge-admission
// expectation.
const closure = (adjacency: Adjacency): boolean[][] => {
    const n = adjacency.length
    const reachable = adjacency.map(row =>
        Array.from({ length: n }, (_, i) => row.includes(i)),
    )
    for (let k = 0; k < n; k++)
        for (let i = 0; i < n; i++)
            for (let j = 0; j < n; j++)
                reachable[i]![j] ||= reachable[i]![k]! && reachable[k]![j]!
    return reachable
}

const isDAG = (adjacency: Adjacency): boolean =>
    closure(adjacency).every((row, i) => !row[i])

const insertionClosesCycle = (
    adjacency: Adjacency,
    parent: number,
    dependency: number,
): boolean => parent === dependency || closure(adjacency)[dependency]![parent]!

// Each unordered vertex pair is absent, forward, or reverse. A DAG cannot
// contain both directions, so this visits every labeled DAG exactly once.
function* labeledDAGs(n: number): Generator<number[][]> {
    const pairs: [number, number][] = []
    for (let i = 0; i < n; i++)
        for (let j = i + 1; j < n; j++) pairs.push([i, j])
    for (let encoding = 0; encoding < 3 ** pairs.length; encoding++) {
        let digits = encoding
        const adjacency: number[][] = Array.from({ length: n }, () => [])
        for (const [i, j] of pairs) {
            const edge = digits % 3
            digits = Math.floor(digits / 3)
            if (edge === 1) adjacency[i]!.push(j)
            else if (edge === 2) adjacency[j]!.push(i)
        }
        if (isDAG(adjacency)) yield adjacency
    }
}

// Rotate a closed cycle path so it starts at `start`, keeping it closed.
const rotateCycle = (path: readonly number[], start: number): number[] => {
    const open = path.slice(0, -1)
    const index = open.indexOf(start)
    expect(index).toBeGreaterThanOrEqual(0)
    const rotated = [...open.slice(index), ...open.slice(0, index)]
    return [...rotated, rotated[0]!]
}

const expectCausalCyclePath = (
    error: SelectorCircularDependencyError,
    nodes: readonly Selector<number>[],
    graph: Adjacency,
    parent: number,
    dependency: number,
): void => {
    expect(nodes.indexOf(error.selector as Selector<number>)).toBe(parent)
    const rawPath = error.path.map(state =>
        nodes.indexOf(state as Selector<number>),
    )
    expect(rawPath.length).toBeGreaterThanOrEqual(2)
    expect(rawPath.every(index => index >= 0)).toBe(true)
    expect(rawPath[0]).toBe(rawPath.at(-1)!)
    expect(new Set(rawPath.slice(0, -1)).size).toBe(rawPath.length - 1)
    const path = rotateCycle(rawPath, dependency)
    // The reported cycle closes with the causally offending edge
    // parent -> dependency and otherwise walks only effective edges.
    expect(path.at(-2)).toBe(parent)
    for (let i = 1; i < path.length - 1; i++) {
        expect(graph[path[i - 1]!]).toContain(path[i])
    }
}

describe("v1 selector graph semantics", () => {
    test("admits exactly the dependency insertions that keep every labeled DAG acyclic", async () => {
        // Every labeled DAG through four vertices, plus a fixed-stride sample
        // of the five-vertex DAGs, with every possible extra edge attempted
        // from every vertex after the whole graph is current.
        const knownLabeledDAGCounts = [1, 3, 25, 543, 29281]
        const fiveVertexStride = 32
        let graphs = 0
        let cycles = 0
        for (let n = 1; n <= 5; n++) {
            let graphsOfSize = 0
            for (const graph of labeledDAGs(n)) {
                graphsOfSize++
                if (n === 5 && graphsOfSize % fiveVertexStride !== 1) continue
                for (let parent = 0; parent < n; parent++)
                    for (let dependency = 0; dependency < n; dependency++) {
                        const gates: Atom<number>[] = Array.from(
                            { length: n },
                            () => atom(-1),
                        )
                        const nodes: Selector<number>[] = []
                        for (let i = 0; i < n; i++) {
                            const edges = graph[i]!
                            nodes.push(
                                selector(get => {
                                    let sum = 1
                                    for (const edge of edges)
                                        sum += get(nodes[edge]!)
                                    const extra = get(gates[i]!)
                                    if (extra >= 0) sum += get(nodes[extra]!)
                                    return sum
                                }),
                            )
                        }
                        const target = store()
                        for (const node of nodes) target.get(node)
                        const expected = insertionClosesCycle(
                            graph,
                            parent,
                            dependency,
                        )
                        const setter = capture(() =>
                            target.set(gates[parent]!, dependency),
                        )
                        const attempt =
                            "error" in setter
                                ? setter
                                : capture(() => target.get(nodes[parent]!))
                        const context = JSON.stringify({
                            graph,
                            parent,
                            dependency,
                            expected,
                        })
                        if (expected) {
                            cycles++
                            if (!("error" in attempt))
                                throw new Error(`missing cycle for ${context}`)
                            expectCausalCyclePath(
                                circular(attempt.error),
                                nodes,
                                graph,
                                parent,
                                dependency,
                            )
                        } else {
                            if ("error" in attempt)
                                throw new Error(
                                    `false cycle for ${context}: ${String(attempt.error)}`,
                                )
                            const expanded = graph.map((edges, i) =>
                                i === parent ? [...edges, dependency] : edges,
                            )
                            const read = (i: number): number =>
                                1 +
                                expanded[i]!.reduce(
                                    (sum, j) => sum + read(j),
                                    0,
                                )
                            expect(attempt.value).toBe(read(parent))
                        }
                        target.dispose()
                    }
                graphs++
                // End the JS job periodically so queued lifecycle work drains.
                if (graphs % 64 === 0)
                    await new Promise(resolve => setImmediate(resolve))
            }
            expect(graphsOfSize).toBe(knownLabeledDAGCounts[n - 1]!)
        }
        expect(cycles).toBeGreaterThan(0)
    }, 60000)

    test("reports the oracle's cycle selector and path for active and cached rotations", () => {
        const rotation = (length: number, cached: boolean): void => {
            const target = store()
            const gate = atom(false)
            const nodes: Selector<number>[] = []
            for (let i = 0; i < length; i++) {
                nodes.push(
                    selector(get =>
                        cached && i === 0
                            ? get(gate)
                                ? get(nodes[1]!)
                                : 1
                            : get(nodes[(i + 1) % length]!),
                    ),
                )
            }
            if (cached) {
                for (let i = 1; i < length; i++) target.get(nodes[i]!)
                target.set(gate, true)
            }
            const error = circular(
                failure(
                    () => target.get(nodes[0]!),
                    "SelectorCircularDependencyError",
                ),
            )

            let enabled = !cached
            const oracle = createSelectorOracle(
                nodes.map(
                    (_, i): SelectorOracleDefinition => ({
                        kind: "selector",
                        id: String(i),
                        get: get =>
                            cached && i === 0 && !enabled
                                ? { kind: "number", value: 1 }
                                : get(String((i + 1) % length)),
                    }),
                ),
            )
            if (cached) {
                for (let i = 1; i < length; i++) oracle.evaluate(String(i))
                enabled = true
            }
            const outcome = oracle.evaluate(
                "0",
                cached
                    ? { current: nodes.map((_, i) => String(i)).slice(1) }
                    : {},
            ).outcome
            expect(outcome.kind).toBe("error")
            if (outcome.kind !== "error") return
            let root = outcome.error
            while (root.kind === "dependency") root = root.cause
            expect(root.kind).toBe("cycle")
            if (root.kind !== "cycle") return
            expect(nodes.indexOf(error.selector as Selector<number>)).toBe(
                Number(root.selector),
            )
            expect(
                error.path.map(state =>
                    String(nodes.indexOf(state as Selector<number>)),
                ),
            ).toEqual([...root.path])
            target.dispose()
        }
        rotation(1, false)
        rotation(3, false)
        rotation(2, true)
        rotation(4, true)
    })

    test("recovers a subscribed selector after a gated self-cycle without disturbing its source", () => {
        const target = store()
        const gate = atom(false)
        let cyclic: Selector<number>
        cyclic = selector(get => (get(gate) ? get(cyclic) : 1))
        let notifications = 0
        target.sub(cyclic, () => notifications++)
        expect(target.get(cyclic)).toBe(1)
        target.set(gate, true)
        expect(target.get(gate)).toBe(true)
        failure(() => target.get(cyclic), "SelectorCircularDependencyError")
        expect(target.get(gate)).toBe(true)
        target.set(gate, false)
        expect(target.get(cyclic)).toBe(1)
        expect(notifications).toBeGreaterThanOrEqual(1)
        target.dispose()
    })

    test("closes a cycle through cached records from one multi-gate transaction and recovers", () => {
        const target = store()
        const parentGate = atom(false)
        const changedGate = atom(false)
        const laterGate = atom(false)
        let parent: Selector<number>
        let cached: Selector<number>
        const changed = selector(get => (get(changedGate) ? get(cached) : 1))
        const edge = selector(get => get(changed))
        parent = selector(get => (get(parentGate) ? get(edge) : 1))
        cached = selector(get => get(parent))
        const later = selector(get => (get(laterGate) ? 1 : get(changed)))
        for (const state of [edge, cached, later])
            expect(target.get(state)).toBe(1)

        target.txn(transaction => {
            transaction.set(parentGate, true)
            transaction.set(changedGate, true)
            transaction.set(laterGate, true)
        })
        const error = circular(
            failure(
                () => target.get(parent),
                "SelectorCircularDependencyError",
            ),
        )
        expect(error.selector).toBe(parent)
        expect(error.path).toEqual([parent, edge, changed, cached, parent])
        // Unrelated work keeps flowing while the cycle is latched.
        expect(target.get(later)).toBe(1)
        failure(() => target.get(cached), "SelectorCircularDependencyError")

        target.set(parentGate, false)
        expect(target.get(parent)).toBe(1)
        target.set(changedGate, false)
        target.set(parentGate, true)
        expect(target.get(parent)).toBe(1)
        expect(target.get(cached)).toBe(1)
        expect(target.get(edge)).toBe(1)
        target.dispose()
    })

    test("quarantines a write attempted from a comparator or from its result's then getter", () => {
        for (const phase of ["comparator", "then-accessor"] as const) {
            const target: Store = store()
            const source = atom(0)
            let armed = false
            let quarantined: unknown
            const illegal = (): false => {
                try {
                    target.set(source, 7)
                } catch (error) {
                    quarantined = error
                }
                return false
            }
            const derived = selector(get => get(source), {
                equal: () =>
                    armed
                        ? phase === "comparator"
                            ? illegal()
                            : ({
                                  get then(): undefined {
                                      illegal()
                                      return undefined
                                  },
                              } as unknown as boolean)
                        : false,
            })
            expect(target.get(derived)).toBe(0)
            armed = true
            target.set(source, 1)
            if (phase === "comparator") {
                expect(target.get(derived)).toBe(1)
            } else {
                failure(
                    () => target.get(derived),
                    "InvalidSelectorComparatorResultError",
                )
            }
            expect((quarantined as { name?: string })?.name).toBe(
                "SelectorCapabilityError",
            )
            expect(target.get(source)).toBe(1)
            target.dispose()
        }
    })

    test("matches the independent oracle across seeded dynamic rewiring and replays deterministically", () => {
        const seeds = [12648430, 195936478, 3735928559, 4207849484]
        const operationsPerSeed = 2048
        for (const seed of seeds) {
            const replays: string[] = []
            for (let repeat = 0; repeat < 2; repeat++) {
                const target = store()
                const leaves: Atom<number>[] = Array.from(
                    { length: 5 },
                    (_, i) => atom(i),
                )
                const gate = atom(0)
                const definitions: SelectorOracleDefinition[] = [
                    ...leaves.map(
                        (_, i): SelectorOracleDefinition => ({
                            kind: "leaf",
                            id: `a${i}`,
                            state: {
                                kind: "value",
                                value: { kind: "number", value: i },
                            },
                        }),
                    ),
                    {
                        kind: "leaf",
                        id: "gate",
                        state: {
                            kind: "value",
                            value: { kind: "number", value: 0 },
                        },
                    },
                ]
                const states: Selector<number>[] = []
                for (let i = 0; i < 5; i++) {
                    states.push(
                        selector(
                            get =>
                                get(leaves[(get(gate) + i) % 5]!) +
                                (i ? get(states[(get(gate) + i) % i]!) : 0),
                        ),
                    )
                    definitions.push({
                        kind: "selector",
                        id: `s${i}`,
                        get: get => {
                            const gateValue = get("gate")
                            const leaf = get(
                                `a${(numberOf(gateValue) + i) % 5}`,
                            )
                            const nested = i
                                ? numberOf(
                                      get(`s${(numberOf(gateValue) + i) % i}`),
                                  )
                                : 0
                            return {
                                kind: "number",
                                value: numberOf(leaf) + nested,
                            }
                        },
                    })
                }
                const oracle = createSelectorOracle(definitions)
                let random = seed >>> 0
                const output: number[] = []
                for (let step = 0; step < operationsPerSeed; step++) {
                    random ^= random << 13
                    random ^= random >>> 17
                    random ^= random << 5
                    const value = (random >>> 0) % 100
                    if (step % 3 === 0) {
                        target.set(gate, value % 5)
                        oracle.setLeafValue("gate", {
                            kind: "number",
                            value: value % 5,
                        })
                    } else {
                        const index = value % 5
                        target.set(leaves[index]!, value)
                        oracle.setLeafValue(`a${index}`, {
                            kind: "number",
                            value,
                        })
                    }
                    const id = value % 5
                    const expected = oracle.evaluate(`s${id}`).outcome
                    expect(expected.kind).toBe("value")
                    if (expected.kind !== "value") return
                    const actual = target.get(states[id]!)
                    expect(actual).toBe(numberOf(expected.value))
                    output.push(actual)
                }
                replays.push(output.join(","))
                target.dispose()
            }
            expect(replays[0]).toBe(replays[1]!)
        }
    })
})

const numberOf = (token: { kind: string; value?: unknown }): number => {
    if (token.kind !== "number")
        throw new Error(`expected number token, got ${token.kind}`)
    return token.value as number
}
