import { describe, expect, test } from "bun:test"
import { SelectorCircularDependencyError } from "../../src/v1-internal/selector-evaluator/errors"
import {
    evaluateSelector,
    tryProveNoDependencyPathReverse,
} from "../../src/v1-internal/selector-evaluator/evaluate"
import {
    SelectorEvaluationSession,
    type SelectorEvaluationHost,
} from "../../src/v1-internal/selector-evaluator/types"

// A settlement session opened inside another session's read sees the outer
// frames' accepted reads as transient adjacency. Every negative reverse
// certificate must include those edges too, or decline. (Independent audit R2:
// committed outer -> [], bridge -> [inner], inner -> []; outer has accepted
// outer -> bridge; inner evaluates in a linked session.)

type Node = "outer" | "bridge" | "inner"

const committed = new Map<Node, Node[]>([
    ["outer", []],
    ["bridge", ["inner"]],
    ["inner", []],
])
const token = {}
const host = {
    getSelectorDependencyNodes: (node: Node) => committed.get(node),
    getSelectorRecord: (node: Node) => ({
        dependencies: committed.get(node)!.map(dependency => ({
            node: dependency,
            token,
        })),
    }),
    getComparisonBaseline: () => undefined,
    getSelectorGraphVersion: () => 0,
    createOutcomeToken: () => ({}),
    serve: () => ({ token, outcome: { kind: "value", value: 1 } }),
    visitSelectorDependents(
        node: Node,
        budget: { remaining: number },
        visit: (dependent: Node) => boolean,
    ) {
        for (const [parent, edges] of committed)
            if (edges.includes(node)) {
                if (budget.remaining-- === 0) return false
                if (!visit(parent)) return false
            }
        return true
    },
} as unknown as SelectorEvaluationHost<Node, object>

const linkedSessions = () => {
    const outer = new SelectorEvaluationSession<Node>()
    outer.enter(host, "outer", [{ node: "bridge" }])
    outer.setPrefixRevalidator(host, "outer", () => {})
    return { outer, inner: new SelectorEvaluationSession<Node>(outer) }
}

describe("linked settlement sessions", () => {
    test("reverse certificates include or decline outer frames' accepted reads", () => {
        const { inner } = linkedSessions()
        inner.enter(host, "inner", [])
        inner.setPrefixRevalidator(host, "inner", () => {})
        expect(
            inner
                .getTransientDependencies(host, "outer")
                ?.map(dependency => dependency.node),
        ).toEqual(["bridge"])
        expect(inner.isSoleActiveSelector(host, "inner")).toBe(false)
        const overlay = inner.captureTransientReverseDependents(
            host,
            "inner",
            0,
            4096,
        )
        expect(overlay?.get("bridge")).toEqual(["outer"])
        const newEdge = tryProveNoDependencyPathReverse(
            "outer",
            "inner",
            host,
            inner,
        )
        const topology = tryProveNoDependencyPathReverse(
            "outer",
            "inner",
            host,
            inner,
            undefined,
            true,
            overlay,
        )
        expect(newEdge.startsWith("proven-")).toBe(false)
        expect(topology.startsWith("proven-")).toBe(false)
        inner.leave(host, "inner")
    })

    test("the optimized proof reports the cycle canonical traversal finds", () => {
        const { inner } = linkedSessions()
        const proposal = evaluateSelector(
            { node: "inner", get: get => get("outer") },
            host,
            inner,
        )
        expect(proposal.outcome.kind).toBe("error")
        const error = (proposal.outcome as { error: unknown }).error
        expect(error).toBeInstanceOf(SelectorCircularDependencyError)
        expect((error as SelectorCircularDependencyError).path).toEqual([
            "inner",
            "outer",
            "bridge",
            "inner",
        ])
    })
})
