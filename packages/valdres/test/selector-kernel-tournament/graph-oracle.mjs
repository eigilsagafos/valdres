import { requireGate } from "../../../../scripts/selector-kernel-tournament/gate.mjs"

// Independent Boolean transitive closure. Neither production search policy nor
// the selector oracle's DFS participates in this edge-admission expectation.
export function validateAdjacency(adjacency, caseId = "C-GRAPH-001") {
    requireGate(
        Array.isArray(adjacency) &&
            adjacency.every(
                row =>
                    Array.isArray(row) &&
                    new Set(row).size === row.length &&
                    row.every(
                        v =>
                            Number.isSafeInteger(v) &&
                            v >= 0 &&
                            v < adjacency.length,
                    ),
            ),
        caseId,
        "unknown vertex or malformed adjacency",
    )
}
export function closure(adjacency, caseId = "C-GRAPH-001") {
    validateAdjacency(adjacency, caseId)
    const n = adjacency.length
    const reachable = adjacency.map(row =>
        Array.from({ length: n }, (_, i) => row.includes(i)),
    )
    for (let k = 0; k < n; k++)
        for (let i = 0; i < n; i++)
            for (let j = 0; j < n; j++)
                reachable[i][j] ||= reachable[i][k] && reachable[k][j]
    return reachable
}
export function insertionClosesCycle(adjacency, parent, dependency) {
    validateAdjacency(adjacency)
    requireGate(
        [parent, dependency].every(
            v => Number.isSafeInteger(v) && v >= 0 && v < adjacency.length,
        ),
        "C-GRAPH-001",
        "unknown attempted vertex",
    )
    return parent === dependency || closure(adjacency)[dependency][parent]
}
export function assertDAG(adjacency, caseId = "C-GRAPH-001") {
    requireGate(
        closure(adjacency, caseId).every((row, i) => !row[i]),
        caseId,
        "authoritative graph contains a cycle",
    )
}
export function* labeledDAGs(n) {
    requireGate(
        Number.isInteger(n) && n >= 1 && n <= 5,
        "C-GRAPH-001",
        "node count outside frozen range",
    )
    const pairs = []
    for (let i = 0; i < n; i++)
        for (let j = i + 1; j < n; j++) pairs.push([i, j])
    // Each unordered pair is absent, forward, or reverse. A DAG cannot contain
    // both directions, so this visits every labeled DAG exactly once.
    for (let encoding = 0; encoding < 3 ** pairs.length; encoding++) {
        let digits = encoding
        const adjacency = Array.from({ length: n }, () => [])
        for (const [i, j] of pairs) {
            const edge = digits % 3
            digits = Math.floor(digits / 3)
            if (edge === 1) adjacency[i].push(j)
            else if (edge === 2) adjacency[j].push(i)
        }
        if (closure(adjacency).every((row, i) => !row[i])) yield adjacency
    }
}
export function validateCyclePath(
    {
        path: rawPath,
        parent,
        dependency,
        effective,
        installed,
        causal = true,
        origin = "dependency",
    },
    caseId = "A-GRAPH-001",
) {
    validateAdjacency(effective, caseId)
    validateAdjacency(installed, caseId)
    requireGate(
        installed.length === effective.length &&
            [
                parent,
                dependency,
                ...(Array.isArray(rawPath) ? rawPath : []),
            ].every(
                v => Number.isSafeInteger(v) && v >= 0 && v < effective.length,
            ),
        caseId,
        "unknown path vertex or graph width",
    )
    requireGate(
        ["dependency", "parent"].includes(origin),
        caseId,
        "unknown raw path origin",
    )
    const path =
        origin === "parent" && Array.isArray(rawPath)
            ? [...rawPath.slice(1), rawPath[1]]
            : rawPath
    if (origin === "parent")
        requireGate(
            rawPath[0] === parent && rawPath.at(-1) === parent,
            caseId,
            "cached path must start at parent",
        )
    requireGate(
        Array.isArray(path) && path.length >= 2 && path[0] === path.at(-1),
        caseId,
        "cycle path must be closed",
    )
    requireGate(
        new Set(path.slice(0, -1)).size === path.length - 1,
        caseId,
        "cycle path repeats an interior vertex",
    )
    if (causal)
        requireGate(
            path[0] === dependency && path.at(-2) === parent,
            caseId,
            "path does not end with the causally closing edge",
        )
    requireGate(
        !installed[parent].includes(dependency),
        caseId,
        "offending edge was installed",
    )
    for (let i = 1; i < path.length; i++) {
        const from = path[i - 1],
            to = path[i]
        requireGate(
            (from === parent && to === dependency) ||
                effective[from]?.includes(to),
            caseId,
            "path uses an absent effective edge",
        )
    }
    assertDAG(installed, caseId)
}

// Contract C admits any structurally valid reported cycle. C does not impose
// Contract A's causal blame, raw origin, or accepted-prefix guarantees.
export function validateGraphRejection(attempt, graph, stage) {
    requireGate(
        ["C", "A"].includes(stage),
        "SEMANTIC-STAGE",
        "unknown contract",
    )
    const { parent, dependency, installed, path, blame, value } = attempt
    const causal = stage === "A"
    requireGate(
        value === null && (!causal || blame === parent),
        causal ? "A-GRAPH-001" : "C-GRAPH-001",
        "wrong cycle result or causal blame",
    )
    validateCyclePath(
        {
            path,
            parent,
            dependency,
            effective: graph,
            installed: installed ?? graph,
            causal,
            origin:
                causal && path?.[0] !== dependency ? "parent" : "dependency",
        },
        causal ? "A-GRAPH-001" : "C-GRAPH-001",
    )
    if (causal && installed)
        requireGate(
            JSON.stringify(installed[parent]) === JSON.stringify(graph[parent]),
            "A-GRAPH-002",
            "earlier prefix lost",
        )
}
