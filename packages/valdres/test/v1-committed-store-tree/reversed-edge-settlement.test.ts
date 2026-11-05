import { describe, expect, test } from "bun:test"
import {
    SelectorCircularDependencyError,
    atom,
    family,
    selector,
    store,
    type Selector,
    type Store,
} from "../../src/index"
import {
    CYCLE,
    expand,
    graphStates,
    settle,
    writeGraph,
    type Graph,
} from "./reversed-edge-graph.harness"

// One commit reverses a dependency between cached selectors. The previous and
// final graphs are both acyclic, so settlement must evaluate the new graph,
// agree with a fresh Store, and never install a cycle error proven from edges
// the commit made obsolete. The ShiftX shape (packet
// valdres-reversed-edge-false-cycle, beta.46) comes first; the minimal graph
// cases below isolate each way settlement could accept an obsolete edge.

type Row = {
    readonly parent?: string
    readonly decision?: string
    readonly subProcess?: string
    readonly probability?: number
    readonly items?: readonly string[]
}
type Rows = Readonly<Record<string, Row>>

// X <- P <- S <- Y <- D(root): S sits on D's path Y, and X on S's path P.
const before: Rows = {
    D: { parent: "root" },
    S: { parent: "Y" },
    X: { parent: "P" },
    Y: { decision: "D", probability: 0.5, items: ["S"] },
    P: { subProcess: "S", items: ["X"] },
}
// X <- Y <- D <- P <- S(root): the S/D edge has reversed.
const after: Rows = {
    D: { parent: "P" },
    S: { parent: "root" },
    X: { parent: "Y" },
    Y: { decision: "D", probability: 0.5, items: ["X"] },
    P: { subProcess: "S", items: ["D"] },
}
const refs = ["D", "S", "X", "Y", "P"] as const

const shiftxGraph = ({ readsOwnRow = true } = {}) => {
    const row = family((ref: string) => atom<Row | null>(null))
    const parentOf = family((ref: string) =>
        selector(get => get(row(ref))?.parent),
    )
    const decisionOf = family((path: string) =>
        selector(get => get(row(path))?.decision),
    )
    const subProcessOf = family((path: string) =>
        selector(get => get(row(path))?.subProcess),
    )
    const input: (ref: string) => Selector<number> = family((ref: string) =>
        selector(get => {
            const sequence = get(parentOf(ref))
            if (sequence === "root") return 1
            if (sequence === "Y") return get(decisionPathInput("Y"))
            return get(subProcessPathInput("P"))
        }),
    )
    const decisionPathInput: (path: string) => Selector<number> = family(
        (path: string) =>
            selector(
                get =>
                    get(input(get(decisionOf(path))!)) *
                    (readsOwnRow ? get(row(path))!.probability! : 0.5),
            ),
    )
    const subProcessPathInput: (path: string) => Selector<number> = family(
        (path: string) => selector(get => get(input(get(subProcessOf(path))!))),
    )
    const write = (
        target: Store,
        rows: Rows,
        order: readonly string[] = refs,
        scope?: Store,
    ) =>
        target.txn(transaction => {
            const writer =
                scope === undefined ? transaction : transaction.scope(scope)
            for (const ref of order) writer.set(row(ref), rows[ref]!)
        })
    const all: Selector<number>[] = [
        ...refs.map(ref => input(ref)),
        decisionPathInput("Y"),
        subProcessPathInput("P"),
    ]
    return { row, input, decisionPathInput, subProcessPathInput, write, all }
}

const outcome = (target: Store, state: Selector<number>): number | string => {
    try {
        return target.get(state)
    } catch (error) {
        let cause = error as { cause?: unknown; name?: unknown }
        while (cause.cause !== undefined) cause = cause.cause as typeof cause
        return String(cause.name)
    }
}

const freshOutcomes = (rows: Rows): (number | string)[] => {
    const graph = shiftxGraph()
    const target = store()
    graph.write(target, rows)
    const values = graph.all.map(state => outcome(target, state))
    target.dispose()
    return values
}

const permutations = <Value>(values: readonly Value[]): Value[][] =>
    values.length <= 1
        ? [[...values]]
        : values.flatMap((value, index) =>
              permutations([
                  ...values.slice(0, index),
                  ...values.slice(index + 1),
              ]).map(rest => [value, ...rest]),
          )

describe("committed settlement after a dependency reversal", () => {
    test("evaluates the reversed ShiftX path instead of an old-closure cycle", () => {
        const graph = shiftxGraph()
        const target = store()
        graph.write(target, before)
        expect(target.get(graph.input("X"))).toBe(0.5)

        graph.write(target, after)

        // X <- Y <- D <- P <- S(root) = 1 * 0.5, and it stays readable.
        expect(target.get(graph.input("X"))).toBe(0.5)
        expect(target.get(graph.input("X"))).toBe(0.5)
        expect(graph.all.map(state => outcome(target, state))).toEqual(
            freshOutcomes(after),
        )
        target.dispose()
    })

    test("controls: a fresh Store and an uncached commit agree", () => {
        expect(freshOutcomes(after)).toEqual([1, 1, 0.5, 1, 1, 0.5, 1])
        const graph = shiftxGraph()
        const target = store()
        graph.write(target, before)
        graph.write(target, after)
        expect(graph.all.map(state => outcome(target, state))).toEqual(
            freshOutcomes(after),
        )
        target.dispose()
    })

    test("control: a path that does not read its rewritten row settles", () => {
        const graph = shiftxGraph({ readsOwnRow: false })
        const target = store()
        graph.write(target, before)
        expect(target.get(graph.input("X"))).toBe(0.5)
        graph.write(target, after)
        expect(target.get(graph.input("X"))).toBe(0.5)
        target.dispose()
    })

    test("every write order and cached read set agrees with a fresh Store", () => {
        const expected = freshOutcomes(after)
        const readSets: readonly (readonly string[])[] = [
            ["X"],
            ["S"],
            ["X", "S"],
            ["D", "X"],
            refs,
        ]
        for (const order of permutations(refs))
            for (const reads of readSets) {
                const graph = shiftxGraph()
                const target = store()
                graph.write(target, before)
                for (const ref of reads) target.get(graph.input(ref))
                graph.write(target, after, order)
                expect({
                    order,
                    reads,
                    values: graph.all.map(state => outcome(target, state)),
                }).toEqual({ order, reads, values: expected })
                target.dispose()
            }
    })

    test("repeated reversals keep agreeing with a fresh Store", () => {
        const graph = shiftxGraph()
        const target = store()
        const expected = {
            before: freshOutcomes(before),
            after: freshOutcomes(after),
        }
        for (let round = 0; round < 4; round++)
            for (const [name, rows] of [
                ["before", before],
                ["after", after],
            ] as const) {
                graph.write(
                    target,
                    rows,
                    round % 2 === 0 ? refs : [...refs].reverse(),
                )
                expect({
                    round,
                    name,
                    values: graph.all.map(state => outcome(target, state)),
                }).toEqual({ round, name, values: expected[name] })
            }
        target.dispose()
    })

    test("subscribers observe settled values and no cycle error", () => {
        const graph = shiftxGraph()
        const target = store()
        graph.write(target, before)
        const seen: (number | string)[][] = graph.all.map(() => [])
        const stops = graph.all.map((state, index) =>
            target.sub(state, () => seen[index]!.push(outcome(target, state))),
        )
        graph.write(target, after)
        const expected = freshOutcomes(after)
        const beforeValues = freshOutcomes(before)
        graph.all.forEach((state, index) => {
            // Equality pruning: an unchanged value is not delivered.
            if (beforeValues[index] === expected[index])
                expect(seen[index]).toEqual([])
            else expect(seen[index]).toEqual([expected[index]!])
            expect(outcome(target, state)).toBe(expected[index]!)
        })
        stops.forEach(stop => stop())
        target.dispose()
    })

    for (const scoping of ["inherited", "owned"] as const)
        test(`scope-qualified rows: ${scoping}`, () => {
            const graph = shiftxGraph()
            const root = store()
            const child = root.scope()
            const writeScope = scoping === "owned" ? child : undefined
            // An owned override shadows a different root graph.
            if (scoping === "owned") graph.write(root, after)
            graph.write(root, before, refs, writeScope)
            expect(child.get(graph.input("X"))).toBe(0.5)
            graph.write(root, after, refs, writeScope)
            expect(graph.all.map(state => outcome(child, state))).toEqual(
                freshOutcomes(after),
            )
            root.dispose()
        })

    test("a rolled-back reversal keeps the cached path, then commits", () => {
        const graph = shiftxGraph()
        const target = store()
        graph.write(target, before)
        expect(target.get(graph.input("X"))).toBe(0.5)
        const rollback = new Error("rollback")
        expect(() =>
            target.txn(transaction => {
                for (const ref of refs)
                    transaction.set(graph.row(ref), after[ref]!)
                throw rollback
            }),
        ).toThrow(rollback)
        expect(graph.all.map(state => outcome(target, state))).toEqual(
            freshOutcomes(before),
        )
        graph.write(target, after)
        expect(graph.all.map(state => outcome(target, state))).toEqual(
            freshOutcomes(after),
        )
        target.dispose()
    })

    test("a reversal that closes a real cycle reports it and recovers", () => {
        const graph = shiftxGraph()
        const target = store()
        graph.write(target, before)
        expect(target.get(graph.input("X"))).toBe(0.5)
        // D sits on S's path P while S stays on D's path Y: a real cycle.
        const cyclic: Rows = { ...after, S: { parent: "Y" } }
        graph.write(target, cyclic)
        expect(outcome(target, graph.input("X"))).toBe(
            "SelectorCircularDependencyError",
        )
        let thrown: unknown
        try {
            target.get(graph.input("D"))
        } catch (error) {
            thrown = error
        }
        let cause = thrown as { cause?: unknown }
        while (cause.cause !== undefined) cause = cause.cause as typeof cause
        expect(cause).toBeInstanceOf(SelectorCircularDependencyError)
        const cycle = (cause as SelectorCircularDependencyError).path
        expect(cycle[0]).toBe(cycle[cycle.length - 1])
        expect(new Set(cycle)).toEqual(
            new Set([
                graph.input("D"),
                graph.subProcessPathInput("P"),
                graph.input("S"),
                graph.decisionPathInput("Y"),
            ]),
        )
        // A latched cycle records no closing edge, so the commit that breaks
        // it changes the first read of every selector on the cycle.
        const broken: Rows = {
            D: { parent: "root" },
            S: { parent: "root" },
            X: { parent: "Y" },
            Y: { decision: "S", probability: 0.5, items: ["X"] },
            P: { subProcess: "D", items: [] },
        }
        for (const rows of [broken, after]) {
            graph.write(target, rows)
            expect(graph.all.map(state => outcome(target, state))).toEqual(
                freshOutcomes(rows),
            )
        }
        target.dispose()
    })
})

describe("recovery after a real cycle", () => {
    test("the ShiftX shape recovers when the commit breaks the cycle elsewhere", () => {
        const graph = shiftxGraph()
        const target = store()
        graph.write(target, before)
        const stop = target.sub(graph.input("X"), () => {})
        graph.write(target, { ...after, S: { parent: "Y" } })
        expect(outcome(target, graph.input("D"))).toBe(
            "SelectorCircularDependencyError",
        )
        // Only S's row changes, so a latch on any other selector on the
        // cycle can only recover through the cycle it reported.
        graph.write(target, after)
        expect(graph.all.map(state => outcome(target, state))).toEqual(
            freshOutcomes(after),
        )
        stop()
        target.dispose()
    })

    test("a cycle that persists across commits stays reported and settles each commit", () => {
        const states = graphStates(3, [true, false, false])
        const target = store()
        const notified = [0, 0, 0]
        const stops = [0, 1, 2].map(node =>
            target.sub(states.node(node), () => notified[node]!++),
        )
        const cyclic: Graph = [[1], [0], [0]]
        writeGraph(target, states, cyclic)
        for (let commit = 1; commit <= 4; commit++) {
            notified.fill(0)
            // Rewrite every row with equal contents: members re-evaluate and
            // republish, which reopens the latched selector once.
            writeGraph(
                target,
                states,
                cyclic.map(row => [...row]),
            )
            expect(
                [0, 1, 2].map(node => settle(target, states.node(node))),
            ).toEqual([CYCLE, CYCLE, CYCLE])
            for (const count of notified) expect(count).toBeLessThanOrEqual(1)
        }
        writeGraph(target, states, [[1], [], [0]])
        expect(
            [0, 1, 2].map(node => settle(target, states.node(node))),
        ).toEqual(expand([[1], [], [0]]))
        stops.forEach(stop => stop())
        target.dispose()
    })
})

const replay = (
    size: number,
    throughComparator: readonly boolean[],
    initial: Graph,
    commits: readonly {
        readonly reads: readonly number[]
        readonly graph: Graph
        readonly order: readonly number[]
    }[],
    subscribed: readonly number[] = [],
): string[] => {
    const states = graphStates(size, throughComparator)
    const target = store()
    writeGraph(target, states, initial)
    const stops = subscribed.map(node =>
        target.sub(states.node(node), () => {}),
    )
    for (const commit of commits) {
        for (const node of commit.reads) target.get(states.node(node))
        writeGraph(target, states, commit.graph, commit.order)
    }
    const values = [...Array(size).keys()].map(node =>
        settle(target, states.node(node)),
    )
    stops.forEach(stop => stop())
    target.dispose()
    return values
}

describe("reversal settlement never accepts an obsolete edge", () => {
    test("a read evaluates a selector whose old-dependency walk is suspended", () => {
        // n0 -> n3 reverses into n3 -> n2 -> n0. While n2's old walk is
        // suspended in n0, n3 reads n2; n2's record leads through dirty n0's
        // obsolete edge back to n3.
        const graph: Graph = [[], [2], [0], [2]]
        const values = replay(
            4,
            [false, false, true, true],
            [[3], [], [0], []],
            [{ reads: [1, 2], graph, order: [2, 3, 1, 0] }],
        )
        expect(values).toEqual(expand(graph))
        expect(values).not.toContain(CYCLE)
    })

    test("a walk that finished around a suspended walk is evaluated by its reader", () => {
        // n2's new read reaches n0, whose walk finished while n1's walk was
        // still suspended; n1 leads through dirty n3's obsolete edge to n2.
        const graph: Graph = [[1], [3], [0], [], [1]]
        const values = replay(
            5,
            [true, true, true, false, false],
            [[], [], [], [], []],
            [
                {
                    reads: [],
                    graph: [[1], [3], [], [4, 2], []],
                    order: [1, 0, 3, 2, 4],
                },
                { reads: [0], graph, order: [2, 4, 3, 0, 1] },
            ],
        )
        expect(values).toEqual(expand(graph))
    })

    test("a proof reads an outer evaluation through its accepted reads", () => {
        // n0's proof reaches n4 while n4 is still evaluating in an outer
        // session; n4's record keeps the old edge to n0 its new reads drop.
        const graph: Graph = [[2], [], [3], [4], [1]]
        const values = replay(
            5,
            [false, false, false, true, false],
            [[2], [0], [], [4], [0]],
            [{ reads: [], graph, order: [4, 1, 2, 0, 3] }],
            [1, 3],
        )
        expect(values).toEqual(expand(graph))
    })

    test("a read in flight elsewhere does not vouch for the edges after it", () => {
        // n0 reads n1, whose first unsettled dependency n2 is evaluating in
        // another session; n1's later dependency n3 is dirty and still holds
        // its obsolete edge back to n0.
        const graph: Graph = [[1], [2, 3], [3], [], [1]]
        const values = replay(
            5,
            [false, true, false, true, false],
            [[], [2, 3], [], [4, 0], []],
            [{ reads: [], graph, order: [3, 4, 2, 1, 0] }],
            [1],
        )
        expect(values).toEqual(expand(graph))
    })

    test("an install that read a superseded value settles again", () => {
        // n6 reads n2 while n2's upstream n4 is still evaluating; n2 then
        // changes before n6 installs. The install must not keep the old n2.
        const graph: Graph = [
            [7],
            [3],
            [4],
            [6],
            [7],
            [],
            [2, 8],
            [5],
            [0, 2, 4],
        ]
        const values = replay(
            9,
            [false, false, true, false, false, false, false, false, false],
            [[], [2], [4], [], [], [1], [], [6], []],
            [{ reads: [5, 7], graph, order: [1, 2, 0, 6, 8, 7, 4, 3, 5] }],
        )
        expect(values).toEqual(expand(graph))
    })

    test("a reader of a settlement that later reopens settles again", () => {
        // n0 settles on a value that read a pending n7, so it reopens once n7
        // changes. n1 read the reopened n0 and is still evaluating when n0
        // republishes, so no change can reach n1 through an installed edge.
        const graph: Graph = [[2], [0, 3], [7], [0], [], [2], [], [8], [6]]
        const values = replay(
            9,
            [false, false, false, false, false, false, false, true, false],
            [[3, 1], [6], [], [], [], [], [], [], []],
            [
                {
                    reads: [],
                    graph: [[], [], [], [2], [8, 0, 7], [], [4, 5], [8], []],
                    order: [8, 4, 2, 7, 1, 5, 3, 0, 6],
                },
                { reads: [], graph, order: [4, 8, 0, 1, 2, 3, 7, 5, 6] },
            ],
            [0],
        )
        expect(values).toEqual(expand(graph))
    })

    test("a superseded read is caught after its dependency is dirty again", () => {
        // n2 reads n4 while n4's upstream n5 is evaluating elsewhere. n4 then
        // republishes and is dirtied again before n2 installs; its final
        // token equals the republished one, so no later change reaches n2.
        const graph: Graph = [[7], [5], [4, 1], [5], [5], [0, 6], [], []]
        const values = replay(
            8,
            [false, false, false, false, true, false, false, false],
            [[6], [], [0, 1], [], [], [], [], []],
            [
                {
                    reads: [],
                    graph: [[], [4, 7], [], [], [5], [], [3, 4], [2]],
                    order: [7, 4, 3, 5, 6, 0, 1, 2],
                },
                { reads: [], graph, order: [4, 1, 0, 5, 6, 2, 7, 3] },
            ],
            [2],
        )
        expect(values).toEqual(expand(graph))
    })
})

// Minimal cases from the recovery differential (`.context/recovery`,
// `original(seed, n)`: generate(seed, n, 5) with every third commit closing a
// cycle). A latched cycle records no closing edge; each case breaks the cycle
// through a selector other than the one that latched it, and the final graph
// is acyclic.
describe("a latched cycle recovers through the cycle it reported", () => {
    const cases: readonly {
        readonly name: string
        readonly size: number
        readonly throughComparator: readonly boolean[]
        readonly initial: Graph
        readonly commits: readonly {
            readonly reads: readonly number[]
            readonly graph: Graph
            readonly order: readonly number[]
        }[]
        readonly subscribed?: readonly number[]
    }[] = [
        {
            // N=5 seed 997: the candidate first latched n1, beta.46 n3.
            name: "a member other than the latch republishes",
            size: 4,
            throughComparator: [true, true, false, false],
            initial: [[], [], [0], [2, 1]],
            commits: [
                {
                    reads: [3],
                    graph: [[2, 3], [3], [], [2]],
                    order: [1, 3, 0, 2],
                },
                {
                    reads: [],
                    graph: [[2, 3], [0], [1], [0]],
                    order: [3, 2, 1, 0],
                },
                { reads: [], graph: [[], [0], [], []], order: [0, 2, 1, 3] },
            ],
        },
        {
            // N=7 seed 929: a subscribed reader of the latch.
            name: "the cycle forms while a reader is subscribed",
            size: 5,
            throughComparator: [false, true, true, false, true],
            initial: [[], [], [], [], [3]],
            commits: [
                {
                    reads: [2],
                    graph: [[1], [2], [4], [1], [0]],
                    order: [1, 3, 4, 0, 2],
                },
                {
                    reads: [],
                    graph: [[], [2], [], [], []],
                    order: [1, 4, 0, 3, 2],
                },
            ],
            subscribed: [4],
        },
        {
            // N=7 seed 949: the latch keeps its own row and edge to the cycle.
            name: "the latch's own row is unchanged",
            size: 5,
            throughComparator: [true, false, true, false, false],
            initial: [[], [], [], [], []],
            commits: [
                {
                    reads: [],
                    graph: [[1, 2], [], [3, 4], [], []],
                    order: [0, 2, 4, 3, 1],
                },
                {
                    reads: [],
                    graph: [[2], [2], [3, 4], [0], [2]],
                    order: [2, 0, 4, 3, 1],
                },
                {
                    reads: [],
                    graph: [[2], [], [], [], []],
                    order: [3, 0, 4, 1, 2],
                },
            ],
            subscribed: [0],
        },
        {
            // N=5 seed 27: beta.46 also stayed failed.
            name: "a three-selector rotation broken downstream",
            size: 3,
            throughComparator: [true, false, false],
            initial: [[], [], []],
            commits: [
                { reads: [], graph: [[1], [2], [0]], order: [1, 2, 0] },
                { reads: [], graph: [[1], [], []], order: [0, 2, 1] },
            ],
            subscribed: [1],
        },
    ]
    for (const scenario of cases)
        test(scenario.name, () => {
            expect(
                scenario.commits.some(commit =>
                    expand(commit.graph).includes(CYCLE),
                ),
            ).toBe(true)
            const final = scenario.commits.at(-1)!.graph
            expect(expand(final)).not.toContain(CYCLE)
            expect(
                replay(
                    scenario.size,
                    scenario.throughComparator,
                    scenario.initial,
                    scenario.commits,
                    scenario.subscribed,
                ),
            ).toEqual(expand(final))
        })
})
