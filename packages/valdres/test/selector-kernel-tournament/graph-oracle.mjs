import { requireGate } from "../../../../scripts/selector-kernel-tournament/inputs.mjs"

// Independent Boolean transitive closure. Neither production search policy nor
// the selector oracle's DFS participates in this edge-admission expectation.
export function closure(adjacency) {
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
    return parent === dependency || closure(adjacency)[dependency][parent]
}
export function assertDAG(adjacency, caseId = "C-GRAPH-001") {
    requireGate(
        closure(adjacency).every((row, i) => !row[i]),
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
    { path, parent, dependency, effective, installed, causal = true },
    caseId = "A-GRAPH-001",
) {
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
            path[0] === parent && path[1] === dependency,
            caseId,
            "path does not start with the causally closing edge",
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
