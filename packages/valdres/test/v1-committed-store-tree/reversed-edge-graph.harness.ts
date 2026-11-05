import {
    atom,
    collection,
    externalAtom,
    family,
    selector,
    store,
    type Atom,
    type Selector,
    type State,
    type Store,
} from "../../src/index"

// A selector graph whose edges are data. Node i reads its adjacency row, then
// every listed node in order, and renders the subtree it read, so equal
// renders mean equal graphs. A row read through a comparator selector keeps
// the node clean when only the row's identity changes.

export type Graph = readonly (readonly number[])[]

export const CYCLE = "!cycle"

/** Renders every node of the graph, or CYCLE when it reaches a cycle. */
export const expand = (graph: Graph): string[] => {
    const memo = new Map<number, string>()
    const active = new Set<number>()
    const visit = (node: number): string => {
        const known = memo.get(node)
        if (known !== undefined) return known
        if (active.has(node)) return CYCLE
        active.add(node)
        const parts: string[] = []
        let rendered: string | undefined
        for (const dependency of graph[node]!) {
            const part = visit(dependency)
            if (part === CYCLE) {
                rendered = CYCLE
                break
            }
            parts.push(part)
        }
        active.delete(node)
        rendered ??= `n${node}[${parts.join(",")}]`
        memo.set(node, rendered)
        return rendered
    }
    // A node that reaches a cycle fails whichever node is read first.
    return graph.map((_, node) => {
        memo.clear()
        return visit(node)
    })
}

export interface GraphStates {
    readonly row: (node: number) => Atom<readonly number[]>
    readonly node: (node: number) => Selector<string>
    readonly index: ReadonlyMap<unknown, number>
}

export const graphStates = (
    size: number,
    throughComparator: readonly boolean[] = [],
): GraphStates => {
    const row = family((node: number) => atom<readonly number[]>([]))
    const comparedRow = family((node: number) =>
        selector(get => get(row(node)), {
            equal: (left, right) => left.join() === right.join(),
        }),
    )
    const node: (index: number) => Selector<string> = family((index: number) =>
        selector(get => {
            const dependencies = throughComparator[index]
                ? get(comparedRow(index))
                : get(row(index))
            return `n${index}[${dependencies.map(next => get(node(next))).join(",")}]`
        }),
    )
    const index = new Map<unknown, number>()
    for (let i = 0; i < size; i++) index.set(node(i), i)
    return { row, node, index }
}

export type RowSource = "collection" | "external"

export interface SourcedGraph {
    readonly node: (node: number) => Selector<string>
    /** Commits a whole graph, in `order`, the way the source changes. */
    readonly commit: (
        target: Store,
        graph: Graph,
        order?: readonly number[],
    ) => void
    /** Keeps an external source subscribed, as a mounted reader would. */
    readonly retain: (target: Store) => () => void
}

/** The same graph with rows from roc-db-style collection rows, or from one
 * external source that notifies when it is replaced. */
export const sourcedGraph = (
    size: number,
    source: RowSource,
    throughComparator: readonly boolean[] = [],
): SourcedGraph => {
    let snapshot: Graph = Array.from({ length: size }, () => [])
    const listeners = new Set<() => void>()
    const document = externalAtom<Graph>({
        getSnapshot: () => snapshot,
        subscribe: notify => {
            listeners.add(notify)
            return () => listeners.delete(notify)
        },
    })
    const rows = collection<number, readonly number[]>({ name: "rows" })
    const row = (node: number): State<readonly number[] | undefined> =>
        source === "collection" ? rows(node) : externalRow(node)
    const externalRow = family((node: number) =>
        selector((get): readonly number[] | undefined => get(document)[node]),
    )
    const comparedRow = family((node: number) =>
        selector(get => get(row(node)) ?? [], {
            equal: (left, right) => left.join() === right.join(),
        }),
    )
    const node: (index: number) => Selector<string> = family((index: number) =>
        selector(get => {
            const dependencies = throughComparator[index]
                ? get(comparedRow(index))
                : (get(row(index)) ?? [])
            return `n${index}[${dependencies.map(next => get(node(next))).join(",")}]`
        }),
    )
    return {
        node,
        commit: (target, graph, order = graph.map((_, index) => index)) => {
            if (source === "collection") {
                target.txn(transaction => {
                    for (const index of order)
                        transaction.set(rows(index), [...graph[index]!])
                })
                return
            }
            const next = [...snapshot]
            for (const index of order) next[index] = [...graph[index]!]
            snapshot = next
            for (const notify of [...listeners]) notify()
        },
        retain: target =>
            source === "external" ? target.sub(document, () => {}) : () => {},
    }
}

/** The node's value, or the name of the root cause it throws. */
export const settle = (target: Store, state: Selector<string>): string => {
    try {
        return target.get(state)
    } catch (error) {
        let cause = error as { cause?: unknown; name?: unknown }
        while (cause.cause !== undefined) cause = cause.cause as typeof cause
        return cause.name === "SelectorCircularDependencyError"
            ? CYCLE
            : `!${String(cause.name)}`
    }
}

export const writeGraph = (
    target: Store,
    states: GraphStates,
    graph: Graph,
    order: readonly number[] = graph.map((_, node) => node),
    scope?: Store,
): void =>
    target.txn(transaction => {
        const writer =
            scope === undefined ? transaction : transaction.scope(scope)
        for (const node of order) writer.set(states.row(node), graph[node]!)
    })

export const freshValues = (graph: Graph, size = graph.length): string[] => {
    const states = graphStates(size)
    const target = store()
    writeGraph(target, states, graph)
    const values = graph.map((_, node) => settle(target, states.node(node)))
    target.dispose()
    return values
}

/** Deterministic mulberry32. */
export const random = (seed: number): (() => number) => {
    let state = seed
    return () => {
        state = (state + 0x6d2b79f5) | 0
        let t = Math.imul(state ^ (state >>> 15), 1 | state)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

export const shuffle = <Value>(
    values: Value[],
    next: () => number,
): Value[] => {
    for (let i = values.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1))
        ;[values[i], values[j]] = [values[j]!, values[i]!]
    }
    return values
}

/** A random DAG under a random topological order, so rewrites reverse edges. */
export const randomDag = (
    size: number,
    next: () => number,
    density = 0.5,
): number[][] => {
    const order = shuffle([...Array(size).keys()], next)
    const graph: number[][] = Array.from({ length: size }, () => [])
    for (let from = 0; from < size; from++)
        for (let to = from + 1; to < size; to++)
            if (next() < density) graph[order[from]!]!.push(order[to]!)
    for (const row of graph) shuffle(row, next)
    return graph
}
