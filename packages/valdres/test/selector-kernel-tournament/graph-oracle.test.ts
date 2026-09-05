import { expect, test } from "bun:test"
import {
    insertionClosesCycle,
    labeledDAGs,
    validateCyclePath,
    validateGraphRejection,
} from "./graph-oracle.mjs"

test("enumerates every labeled DAG through five nodes without duplicates", () => {
    const knownCounts = [1, 3, 25, 543, 29281]
    for (let n = 1; n <= 5; n++) {
        const graphs = [...labeledDAGs(n)]
        expect(graphs).toHaveLength(knownCounts[n - 1])
        expect(new Set(graphs.map(graph => JSON.stringify(graph))).size).toBe(
            graphs.length,
        )
        for (const graph of graphs)
            for (let i = 0; i < n; i++)
                expect(insertionClosesCycle(graph, i, i)).toBe(true)
    }
}, 30000)

test("independent closure rejects cycles and accepts acyclic insertions", () => {
    const graph = [[1], [2], []]
    expect(insertionClosesCycle(graph, 2, 0)).toBe(true)
    expect(insertionClosesCycle(graph, 0, 2)).toBe(false)
    expect(insertionClosesCycle(graph, 0, 1)).toBe(false)
})

test("normative causal path checks reject concrete structural mutations", () => {
    const good = {
        path: [0, 1, 2, 0],
        parent: 2,
        dependency: 0,
        effective: [[1], [2], []],
        installed: [[1], [2], []],
    }
    expect(() => validateCyclePath(good)).not.toThrow()
    expect(() =>
        validateCyclePath({ ...good, installed: [[1], [2], [0]] }),
    ).toThrow("offending edge was installed")
    expect(() => validateCyclePath({ ...good, path: [2, 0, 1, 2] })).toThrow(
        "causally closing edge",
    )
    expect(() => validateCyclePath({ ...good, path: [0, 2, 0] })).toThrow(
        "absent effective edge",
    )
})

test("cached raw rotation preserves exactly the same causal graph", () => {
    const input = {
        parent: 2,
        dependency: 0,
        effective: [[1], [2], []],
        installed: [[1], [2], []],
    }
    expect(() =>
        validateCyclePath({ ...input, path: [2, 0, 1, 2], origin: "parent" }),
    ).not.toThrow()
    expect(() =>
        validateCyclePath({ ...input, path: [0, 1, 2, 0], origin: "parent" }),
    ).toThrow("cached path")
    expect(() =>
        validateCyclePath({ ...input, path: [2, 1, 0, 2], origin: "parent" }),
    ).toThrow("causally closing edge")
})

test("Contract C accepts alternate valid rotation and blame while A enforces causal rejection", () => {
    const graph = [[1], [2], []]
    const attempt = {
        parent: 2,
        dependency: 0,
        installed: graph,
        path: [1, 2, 0, 1],
        blame: 1,
        value: null,
    }
    expect(() => validateGraphRejection(attempt, graph, "C")).not.toThrow()
    expect(() => validateGraphRejection(attempt, graph, "A")).toThrow(
        "A-GRAPH-001",
    )
    expect(() =>
        validateGraphRejection({ ...attempt, path: [0, 2, 0] }, graph, "C"),
    ).toThrow("C-GRAPH-001")
    expect(() =>
        validateGraphRejection(
            { ...attempt, installed: [[1], [2], [0]] },
            graph,
            "C",
        ),
    ).toThrow("C-GRAPH-001")
    const prefix = [[1, 2], [2], []]
    const lost = {
        parent: 0,
        dependency: 0,
        installed: [[], [2], []],
        path: [0, 0],
        blame: 0,
        value: null,
    }
    expect(() => validateGraphRejection(lost, prefix, "C")).not.toThrow()
    expect(() => validateGraphRejection(lost, prefix, "A")).toThrow(
        "A-GRAPH-002",
    )
})
