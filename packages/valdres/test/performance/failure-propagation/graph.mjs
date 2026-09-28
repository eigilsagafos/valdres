// Deterministic failure-propagation graph over the public API, shared by the
// count and timing drivers. One root selector reads `tick` and throws while
// `fail` is true; `layers` rows of `width` dependents sit below it.
//
//   chain    node[l][i] reads node[l-1][i]: `width` independent chains
//   diamond  node[l][i] reads node[l-1][i] and node[l-1][(i+1) % width]
//   fanout   node[l][i] reads node[l-1][i >> 1]: each read node has two readers
//   mixed    diamond, and every 7th node catches dependency errors and falls
//            back, so the failure stops there
//
// Every dependent is subscribed unless `subs` is "leaves".
const makeGraph = (define, opts) => {
    const { topology = "chain", width = 100, layers = 20 } = opts
    const counters = { rootThrows: 0, evaluations: 0, fallbacks: 0 }
    const root = define.derived(get => {
        const value = get(define.tick)
        if (get(define.fail)) {
            counters.rootThrows++
            throw new Error("root failure")
        }
        return value
    }, "root")
    const nodes = []
    let previous = [root]
    for (let l = 0; l < layers; l++) {
        const row = []
        for (let i = 0; i < width; i++) {
            const parents =
                l === 0
                    ? [root]
                    : topology === "chain"
                      ? [previous[i]]
                      : topology === "fanout"
                        ? [previous[i >> 1]]
                        : [previous[i], previous[(i + 1) % width]]
            const catches = topology === "mixed" && (l * width + i) % 7 === 3
            row.push(
                define.derived(get => {
                    counters.evaluations++
                    let sum = 1
                    for (const parent of parents) {
                        if (!catches) {
                            sum += get(parent)
                            continue
                        }
                        try {
                            sum += get(parent)
                        } catch {
                            counters.fallbacks++
                            sum -= 1
                        }
                    }
                    return sum
                }, `n${l}_${i}`),
            )
        }
        nodes.push(row)
        previous = row
    }
    return { root, nodes, counters }
}

export const buildGraph = (valdres, opts) => {
    const tick = valdres.atom(0, { name: "tick" })
    const fail = valdres.atom(false, { name: "fail" })
    const graph = makeGraph(
        {
            tick,
            fail,
            derived: (read, name) => valdres.selector(read, { name }),
        },
        opts,
    )
    return subscribe(valdres.store(), tick, fail, graph, opts)
}

// Jotai reference lane: rethrows the dependency's own error, no wrappers.
export const buildJotaiGraph = (jotai, opts) => {
    const tick = jotai.atom(0)
    const fail = jotai.atom(false)
    const graph = makeGraph(
        { tick, fail, derived: read => jotai.atom(read) },
        opts,
    )
    return subscribe(jotai.createStore(), tick, fail, graph, opts)
}

const subscribe = (store, tick, fail, graph, { subs = "all" }) => {
    const subscribed =
        subs === "leaves" ? graph.nodes.at(-1) : graph.nodes.flat()
    let notifications = 0
    const unsubscribes = subscribed.map(node =>
        store.sub(node, () => notifications++),
    )
    return {
        ...graph,
        store,
        tick,
        fail,
        subscribed,
        get notifications() {
            return notifications
        },
        dispose() {
            for (const unsubscribe of unsubscribes) unsubscribe()
            store.dispose?.()
        },
    }
}

export const isLibraryWrapper = value =>
    value !== null &&
    typeof value === "object" &&
    (value.code === "VALDRES_SELECTOR_GETTER_ERROR" ||
        value.code === "VALDRES_SELECTOR_DEPENDENCY_ERROR")

// Reads every subscribed node and folds the outcomes into a signature. With
// `inspect`, walks each error's library cause chain reading its metadata (not
// its stack), like a consumer that reports which selector failed and why.
export const readAll = (graph, inspect = false) => {
    let signature = 0
    let errors = 0
    let maxDepth = 0
    for (const node of graph.subscribed) {
        try {
            signature = (signature * 31 + graph.store.get(node)) | 0
        } catch (error) {
            errors++
            let depth = 0
            if (inspect) {
                for (
                    let cursor = error;
                    isLibraryWrapper(cursor);
                    cursor = cursor.cause
                ) {
                    depth++
                    signature =
                        (signature * 31 +
                            cursor.message.length +
                            (cursor.selector === undefined ? 0 : 1) +
                            (cursor.dependency === undefined ? 0 : 2)) |
                        0
                }
                if (depth > maxDepth) maxDepth = depth
            }
            signature = (signature * 31 + 7) | 0
        }
    }
    return { signature, errors, maxDepth }
}

// Worst-case diagnostic consumer: reads the stack of every library wrapper
// reachable from subscribed outcomes, so lazily deferred stack work is paid.
export const readStacks = graph => {
    let characters = 0
    for (const node of graph.subscribed) {
        try {
            graph.store.get(node)
        } catch (error) {
            for (
                let cursor = error;
                isLibraryWrapper(cursor);
                cursor = cursor.cause
            ) {
                characters += String(cursor.stack).length
            }
        }
    }
    return characters
}
