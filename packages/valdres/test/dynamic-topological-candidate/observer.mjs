// Candidate-owned observation translation, bundled only in the counter artifact.
// It never drives evaluation, chooses edges, repairs records, or reads a model.
const keys = [
    "selectorBodyEntries",
    "suppliedGets",
    "serveCalls",
    "proposalsReturned",
    "proposalsInstalled",
    "dependencyEdgesAdded",
    "dependencyEdgesRemoved",
    "notifications",
    "subscriberCallbacks",
    "publicOperations",
]
let identities,
    symbols,
    labels,
    hosts,
    facades,
    records,
    events,
    counts,
    next,
    tracing,
    topologyCounts
function identity(value) {
    if (
        (typeof value === "object" && value !== null) ||
        typeof value === "function"
    ) {
        if (!identities.has(value)) identities.set(value, `i${next++}`)
        return identities.get(value)
    }
    if (typeof value === "symbol") {
        if (!symbols.has(value)) symbols.set(value, `i${next++}`)
        return symbols.get(value)
    }
    throw new Error("Evidence identity requires an object, function, or symbol")
}
function node(value) {
    return labels.get(value) ?? identity(value)
}
function valueToken(value) {
    const type = typeof value
    if (value === null) return { kind: "null" }
    if (type === "undefined") return { kind: "undefined" }
    if (type === "number")
        return {
            kind: "number",
            value: Number.isNaN(value)
                ? "NaN"
                : Object.is(value, -0)
                  ? "-0"
                  : !Number.isFinite(value)
                    ? String(value)
                    : value,
        }
    if (type === "string" || type === "boolean") return { kind: type, value }
    if (type === "bigint") return { kind: type, value: String(value) }
    return { kind: "identity", identityKind: type, id: identity(value) }
}
function event(row) {
    if (tracing) events.push(row)
}
function host(value) {
    if (!hosts.has(value)) observer.coordinate(value, "unknown")
    return hosts.get(value)
}
function outcome(value) {
    return value.kind === "value"
        ? { kind: "value", value: valueToken(value.value) }
        : { kind: value.kind, error: identity(value.error) }
}
const topoKeys = [
    "insertions",
    "rankChecks",
    "forwardNodes",
    "edgeProbes",
    "relabels",
    "rankWrites",
    "rejections",
    "provisionalBegins",
    "acceptances",
    "rollbacks",
    "hostClears",
]
export const observer = {
    topo(key) {
        topologyCounts[key]++
    },
    mode: "counter",
    reset({ trace = true } = {}) {
        identities = new WeakMap()
        symbols = new Map()
        labels = new WeakMap()
        hosts = new WeakMap()
        facades = new WeakMap()
        records = new Map()
        events = []
        topologyCounts = Object.fromEntries(topoKeys.map(key => [key, 0]))
        counts = Object.fromEntries(keys.map(k => [k, 0]))
        next = 1
        tracing = trace
    },
    resetCounters({ trace = false } = {}) {
        topologyCounts = Object.fromEntries(topoKeys.map(key => [key, 0]))
        counts = Object.fromEntries(keys.map(key => [key, 0]))
        events = []
        tracing = trace
    },
    label(value, label) {
        if (typeof label !== "string" || !label)
            throw Error("Invalid evidence label")
        labels.set(value, label)
        return value
    },
    identity,
    valueToken,
    coordinate(value, kind, parent, generation = 0) {
        const old = hosts.get(value)
        const row = {
            id: old?.id ?? `h${next++}`,
            kind,
            parent: parent ? host(parent).id : null,
            generation,
        }
        hosts.set(value, row)
        if (!records.has(row.id)) records.set(row.id, new Map())
        event({ type: "host", ...row })
        return value
    },
    bind(facade, value) {
        facades.set(facade, host(value).id)
    },
    hostOf(facade) {
        return facades.get(facade)
    },
    body(value, selector) {
        counts.selectorBodyEntries++
        event({ type: "body", host: host(value).id, selector: node(selector) })
    },
    get(value, selector, dependency) {
        counts.suppliedGets++
        event({
            type: "get",
            host: host(value).id,
            selector: node(selector),
            dependency: node(dependency),
        })
    },
    serve() {
        counts.serveCalls++
    },
    proposal(value, proposal) {
        counts.proposalsReturned++
        event({
            type: "proposal",
            host: host(value).id,
            selector: node(proposal.selector),
            outcome: outcome(proposal.outcome),
            token: identity(proposal.token),
            dependencies: proposal.dependencies.map(d => node(d.node)),
        })
    },
    install(value, selector, record) {
        const h = host(value),
            table = records.get(h.id),
            key = node(selector),
            before = table.get(key)?.dependencies ?? [],
            dependencies = record.dependencies.map(d => node(d.node))
        counts.proposalsInstalled++
        for (const d of dependencies)
            if (!before.includes(d)) counts.dependencyEdgesAdded++
        for (const d of before)
            if (!dependencies.includes(d)) counts.dependencyEdgesRemoved++
        const row = {
            selector: key,
            host: h.id,
            generation: h.generation,
            token: identity(record.served.token),
            outcome: outcome(record.served.outcome),
            dependencies,
        }
        table.set(key, row)
        event({ type: "install", ...row })
    },
    clear(value, generation) {
        const h = host(value),
            table = records.get(h.id)
        for (const row of table.values())
            counts.dependencyEdgesRemoved += row.dependencies.length
        table.clear()
        if (generation !== undefined) h.generation = generation
        event({ type: "clear", host: h.id, generation: h.generation })
    },
    notification() {
        counts.notifications++
    },
    callback() {
        counts.subscriberCallbacks++
    },
    operation(count = 1) {
        counts.publicOperations += count
    },
    snapshot() {
        return structuredClone({
            common: counts,
            candidateSpecific: topologyCounts,
            hosts: [...records].map(([id, rows]) => ({
                id,
                records: [...rows.values()],
            })),
            events,
        })
    },
}
observer.reset()
globalThis[Symbol.for("VALDRES_TOURNAMENT_COUNTER_ARTIFACT_V3")] = observer
