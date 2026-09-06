import { test } from "bun:test"
import assert from "node:assert/strict"
import {
    DynamicTopologicalOrder,
    clearTopologicalHost,
    orderFor,
} from "../../src/v1-internal/dynamic-topological/order"
import {
    labeledDAGs,
    closure,
} from "../selector-kernel-tournament/graph-oracle.mjs"

function valid(order: DynamicTopologicalOrder, nodes: object[]) {
    for (const node of nodes) {
        const vertex = order.vertices.get(node)!
        for (const dependency of vertex.edges)
            assert.ok(vertex.rank < order.vertices.get(dependency)!.rank)
    }
}

test("every one-to-five-node DAG insertion agrees with independent closure; rejection leaves rank and adjacency unchanged", async () => {
    let graphs = 0,
        attempts = 0
    for (let n = 1; n <= 5; n++) {
        for (const adjacency of labeledDAGs(n)) {
            const reach = closure(adjacency)
            for (let parent = 0; parent < n; parent++) {
                for (let dependency = 0; dependency < n; dependency++) {
                    const nodes = Array.from({ length: n }, () => ({}))
                    const order = new DynamicTopologicalOrder()
                    for (const node of nodes) {
                        order.begin(node)
                        order.accept(node)
                    }
                    for (let i = 0; i < n; i++) {
                        for (const j of adjacency[i])
                            assert.equal(
                                order.insert(nodes[i]!, nodes[j]!),
                                undefined,
                            )
                    }
                    const before = nodes.map(node => ({
                        rank: order.vertices.get(node)!.rank,
                        edges: [...order.vertices.get(node)!.edges],
                    }))
                    const path = order.insert(
                        nodes[parent]!,
                        nodes[dependency]!,
                    )
                    const cyclic =
                        parent === dependency || reach[dependency][parent]
                    assert.equal(path !== undefined, cyclic)
                    if (path) {
                        assert.equal(path[0], nodes[parent])
                        assert.equal(path.at(-1), nodes[parent])
                        assert.equal(
                            new Set(path.slice(0, -1)).size,
                            path.length - 1,
                        )
                        for (let i = 2; i < path.length; i++)
                            assert.ok(
                                before[
                                    nodes.indexOf(path[i - 1]!)
                                ]!.edges.includes(path[i]!),
                            )
                        assert.deepEqual(
                            nodes.map(node => ({
                                rank: order.vertices.get(node)!.rank,
                                edges: [...order.vertices.get(node)!.edges],
                            })),
                            before,
                        )
                    }
                    valid(order, nodes)
                    attempts++
                }
            }
            if (++graphs % 16 === 0)
                await new Promise(resolve => setImmediate(resolve))
        }
    }
    assert.equal(graphs, 29853)
    assert.equal(attempts, 740951)
}, 120000)

test("provisional removal and rollback repair ranks without restoring rejected edges", () => {
    const [a, b, c] = [{}, {}, {}]
    const order = new DynamicTopologicalOrder()
    for (const node of [a!, b!, c!]) {
        order.begin(node)
        order.accept(node)
    }
    assert.equal(order.insert(a!, b!), undefined)
    order.begin(a!)
    assert.equal(order.insert(c!, a!), undefined)
    assert.equal(order.insert(a!, c!)?.length, 3)
    order.rollback(a!)
    assert.deepEqual(order.vertices.get(a!)!.edges, [b])
    valid(order, [a!, b!, c!])
    order.begin(a!)
    order.accept(a!)
    assert.deepEqual(order.vertices.get(a!)!.edges, [])
    assert.equal(order.insert(b!, a!), undefined)
    valid(order, [a!, b!, c!])
})

test("host identity and lifecycle generations own independent rank state", () => {
    const root = {},
        child = {},
        scratch = {}
    assert.notEqual(orderFor(root), orderFor(child))
    assert.notEqual(orderFor(root), orderFor(scratch))
    const old = orderFor(scratch)
    clearTopologicalHost(scratch)
    assert.notEqual(orderFor(scratch), old)
    assert.equal(orderFor(scratch).order.length, 0)
})
