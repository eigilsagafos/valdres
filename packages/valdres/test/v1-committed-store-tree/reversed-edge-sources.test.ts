import { describe, expect, test } from "bun:test"
import {
    collection,
    externalAtom,
    family,
    selector,
    store,
    type CollectionRow,
    type ExternalSource,
    type Selector,
    type State,
    type Store,
} from "../../src/index"
import { query } from "../../src/query"
import {
    expand,
    settle,
    sourcedGraph,
    type Graph,
    type RowSource,
} from "./reversed-edge-graph.harness"

// The packet's dependency reversal with its rows supplied the ways ShiftX and
// browser packages supply state: roc-db collection rows, membership and scalar
// index queries, and an external source. Each cached Store must agree with a
// fresh Store holding the same final rows.

type Row = {
    readonly parent?: string
    readonly decision?: string
    readonly subProcess?: string
    readonly probability?: number
}
type Rows = Readonly<Record<string, Row>>

// X <- P <- S <- Y <- D(root) becomes X <- Y <- D <- P <- S(root).
const before: Rows = {
    D: { parent: "root" },
    S: { parent: "Y" },
    X: { parent: "P" },
    Y: { decision: "D", probability: 0.5 },
    P: { subProcess: "S" },
}
const after: Rows = {
    D: { parent: "P" },
    S: { parent: "root" },
    X: { parent: "Y" },
    Y: { decision: "D", probability: 0.5 },
    P: { subProcess: "S" },
}
// D sits on S's path while S stays on D's path: a real cycle.
const cyclic: Rows = { ...after, S: { parent: "Y" } }
const refs = ["D", "S", "X", "Y", "P"] as const

const outcome = (target: Store, state: State<any>): unknown => {
    try {
        return target.get(state)
    } catch (error) {
        let cause = error as { cause?: unknown; name?: unknown }
        while (cause.cause !== undefined) cause = cause.cause as typeof cause
        return String(cause.name)
    }
}

/** The packet's selectors over any row source. */
const pathGraph = (row: (ref: string) => State<Row | undefined>) => {
    const parentOf = family((ref: string) =>
        selector(get => get(row(ref))?.parent),
    )
    const input: (ref: string) => Selector<number> = family((ref: string) =>
        selector(get => {
            const sequence = get(parentOf(ref))
            if (sequence === "root") return 1
            if (sequence === "Y") return get(decisionPathInput)
            return get(subProcessPathInput)
        }),
    )
    const decisionPathInput: Selector<number> = selector(
        get =>
            get(input(get(row("Y"))!.decision!)) * get(row("Y"))!.probability!,
    )
    const subProcessPathInput: Selector<number> = selector(get =>
        get(input(get(row("P"))!.subProcess!)),
    )
    const all: State<any>[] = [
        ...refs.map(ref => input(ref)),
        decisionPathInput,
        subProcessPathInput,
    ]
    return { input, all }
}

interface Indexes {
    parent: string | null
}

const collectionGraph = () => {
    const entities = collection<string, Row, string, Indexes>({
        name: "entities",
        indexes: { parent: row => row.parent ?? null },
    })
    const graph = pathGraph(ref => entities(ref))
    // ShiftX draws one line per entity on the canvas; each reads its input.
    const lines = selector(get =>
        get(entities)
            .filter(row => get(row)?.parent !== undefined)
            .map(row => `${row.key}:${get(graph.input(row.key))}`),
    )
    // Items found through the parent index, as roc-db index lookups do.
    // Queries are canonical States: equal definitions share one identity.
    const itemsOn = (path: string) =>
        query(entities, { where: { parent: { eq: path } } })
    const pathTotal = family((path: string) =>
        selector(get =>
            get(itemsOn(path)).reduce(
                (sum, row: CollectionRow<string, Row>) =>
                    sum + get(graph.input(row.key)),
                0,
            ),
        ),
    )
    const all = [...graph.all, lines, pathTotal("Y"), pathTotal("P")]
    const write = (
        target: Store,
        rows: Rows,
        order: readonly string[] = refs,
        scope?: Store,
    ) =>
        target.txn(transaction => {
            const writer =
                scope === undefined ? transaction : transaction.scope(scope)
            for (const ref of order) writer.set(entities(ref), rows[ref]!)
        })
    return { entities, input: graph.input, lines, all, write }
}

const freshCollectionOutcomes = (rows: Rows): unknown[] => {
    const graph = collectionGraph()
    const target = store()
    graph.write(target, rows)
    const values = graph.all.map(state => outcome(target, state))
    target.dispose()
    return values
}

describe("collection-backed reversal", () => {
    for (const subscribed of [false, true])
        test(`rows, membership and index queries settle the reversed graph (subscribed=${subscribed})`, () => {
            const graph = collectionGraph()
            const target = store()
            graph.write(target, before)
            const seen: unknown[][] = graph.all.map(() => [])
            const stops = subscribed
                ? graph.all.map((state, index) =>
                      target.sub(state, () =>
                          seen[index]!.push(outcome(target, state)),
                      ),
                  )
                : []
            expect(graph.all.map(state => outcome(target, state))).toEqual(
                freshCollectionOutcomes(before),
            )
            graph.write(target, after)
            const expected = freshCollectionOutcomes(after)
            expect(expected).not.toContain("SelectorCircularDependencyError")
            expect(graph.all.map(state => outcome(target, state))).toEqual(
                expected,
            )
            // Every delivery saw the settled final value.
            seen.forEach((values, index) =>
                values.forEach(value => expect(value).toEqual(expected[index])),
            )
            stops.forEach(stop => stop())
            target.dispose()
        })

    test("every write order of the reversal agrees with a fresh Store", () => {
        const expected = freshCollectionOutcomes(after)
        const orders = [refs, [...refs].reverse(), ["S", "D", "P", "X", "Y"]]
        for (const order of orders) {
            const graph = collectionGraph()
            const target = store()
            graph.write(target, before)
            target.get(graph.lines)
            const stop = target.sub(graph.input("X"), () => {})
            graph.write(target, after, order)
            expect({
                order,
                values: graph.all.map(state => outcome(target, state)),
            }).toEqual({ order, values: expected })
            stop()
            target.dispose()
        }
    })

    test("scope-owned rows reverse inside a draft scope", () => {
        const graph = collectionGraph()
        const root = store()
        const draft = root.scope("draft")
        graph.write(root, after)
        graph.write(root, before, refs, draft)
        expect(draft.get(graph.input("X"))).toBe(0.5)
        graph.write(root, after, refs, draft)
        expect(graph.all.map(state => outcome(draft, state))).toEqual(
            freshCollectionOutcomes(after),
        )
        // The root's own rows were never reversed.
        expect(graph.all.map(state => outcome(root, state))).toEqual(
            freshCollectionOutcomes(after),
        )
        root.dispose()
    })

    test("a real cycle through collection rows is reported, then recovers", () => {
        const graph = collectionGraph()
        const target = store()
        graph.write(target, before)
        const stop = target.sub(graph.lines, () => {})
        target.get(graph.input("X"))
        graph.write(target, cyclic)
        expect(outcome(target, graph.input("D"))).toBe(
            "SelectorCircularDependencyError",
        )
        graph.write(target, after)
        expect(graph.all.map(state => outcome(target, state))).toEqual(
            freshCollectionOutcomes(after),
        )
        stop()
        target.dispose()
    })
})

/** A row source outside the Store, notified like a browser or sync source. */
const externalRows = (initial: Rows) => {
    let rows = initial
    const listeners = new Set<() => void>()
    const source: ExternalSource<Rows> = {
        getSnapshot: () => rows,
        subscribe: notify => {
            listeners.add(notify)
            return () => listeners.delete(notify)
        },
    }
    const document = externalAtom(source, { name: "rows" })
    const row = family((ref: string) =>
        selector((get): Row | undefined => get(document)[ref]),
    )
    return {
        ...pathGraph(row),
        listeners,
        replace: (next: Rows) => {
            rows = next
            for (const notify of [...listeners]) notify()
        },
    }
}

const freshExternalOutcomes = (rows: Rows): unknown[] => {
    const graph = externalRows(rows)
    const target = store()
    const stop = target.sub(graph.input("X"), () => {})
    const values = graph.all.map(state => outcome(target, state))
    stop()
    target.dispose()
    return values
}

describe("external-atom-driven reversal", () => {
    test("a notified source reversal settles the subscribed graph", () => {
        const graph = externalRows(before)
        const target = store()
        const seen: unknown[] = []
        const stop = target.sub(graph.input("X"), () =>
            seen.push(outcome(target, graph.input("X"))),
        )
        expect(graph.listeners.size).toBe(1)
        expect(graph.all.map(state => outcome(target, state))).toEqual(
            freshExternalOutcomes(before),
        )
        graph.replace(after)
        expect(graph.all.map(state => outcome(target, state))).toEqual(
            freshExternalOutcomes(after),
        )
        // input(X) stayed 0.5 across the reversal: equality pruning holds.
        expect(seen).toEqual([])
        graph.replace(cyclic)
        expect(outcome(target, graph.input("D"))).toBe(
            "SelectorCircularDependencyError",
        )
        graph.replace(after)
        expect(graph.all.map(state => outcome(target, state))).toEqual(
            freshExternalOutcomes(after),
        )
        stop()
        target.dispose()
    })

    test("a dormant source is re-sampled by reads after a reversal", () => {
        const graph = externalRows(before)
        const target = store()
        expect(target.get(graph.input("X"))).toBe(0.5)
        expect(graph.listeners.size).toBe(0)
        graph.replace(after)
        expect(graph.all.map(state => outcome(target, state))).toEqual(
            freshExternalOutcomes(after),
        )
        target.dispose()
    })
})

// Minimal cases from the differential harness with collection and external
// rows (`ROWS=collection|external`, `generate(seed, n, 5)`); all three fail on
// beta.46.
const replaySourced = (
    source: RowSource,
    { live }: { live: boolean },
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
    const graph = sourcedGraph(size, source, throughComparator)
    const target = store()
    const release = live ? graph.retain(target) : () => {}
    graph.commit(target, initial)
    const stops = subscribed.map(node => target.sub(graph.node(node), () => {}))
    for (const commit of commits) {
        for (const node of commit.reads) target.get(graph.node(node))
        graph.commit(target, commit.graph, commit.order)
    }
    const values = [...Array(size).keys()].map(node =>
        settle(target, graph.node(node)),
    )
    stops.forEach(stop => stop())
    release()
    target.dispose()
    return values
}

describe("reversals over collection and external graph rows", () => {
    // n2 -> n3 reverses into n3 -> n0 -> n1 -> n2 while n1 is cached and n0
    // subscribed (seed 228 for both sources).
    const reversal = {
        throughComparator: [false, true, false, false],
        initial: [[], [2], [3], []] as Graph,
        graph: [[1], [2], [], [0]] as Graph,
        order: [0, 3, 1, 2],
    }
    for (const source of ["collection", "external"] as const)
        test(`${source} rows: a reversal is not proven a cycle from its old closure`, () => {
            const values = replaySourced(
                source,
                { live: true },
                4,
                reversal.throughComparator,
                reversal.initial,
                [{ reads: [1], graph: reversal.graph, order: reversal.order }],
                [0],
            )
            expect(values).toEqual(expand(reversal.graph))
        })

    test("collection rows: a superseded read does not keep a stale value", () => {
        // Seed 485 (n=7): n1 is subscribed; the second commit reverses n0 -> n2
        // around the cached n4 and leaves a stale subtree on beta.46.
        const graph: Graph = [[2], [2], [3], [], [], [0, 1, 4]]
        const values = replaySourced(
            "collection",
            { live: true },
            6,
            [true, false, false, false, false, false],
            [[], [3], [], [], [], []],
            [
                {
                    reads: [],
                    graph: [[2], [], [], [5], [0], []],
                    order: [5, 4, 1, 3, 2, 0],
                },
                { reads: [4], graph, order: [2, 4, 3, 0, 1, 5] },
            ],
            [1],
        )
        expect(values).toEqual(expand(graph))
    })

    test("a dormant external source re-sampled by reads settles the reversal", () => {
        // Seed 487: no reader keeps the source subscribed, so each read pulls
        // its current snapshot; n0 -> n1 -> n2 -> n3 becomes n3 -> n1 -> n2.
        const graph: Graph = [[], [2], [], [1]]
        const values = replaySourced(
            "external",
            { live: false },
            4,
            [false, true, false, false],
            [[], [], [], []],
            [
                { reads: [], graph: [[1], [2], [3], []], order: [1, 0, 2, 3] },
                { reads: [0], graph, order: [3, 2, 0, 1] },
            ],
        )
        expect(values).toEqual(expand(graph))
    })
})
