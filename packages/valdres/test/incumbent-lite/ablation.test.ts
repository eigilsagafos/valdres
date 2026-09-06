import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import {
    atom,
    selector,
    store,
    SelectorCircularDependencyError,
    type Selector,
} from "../../src/index"
import { createInspectableStore } from "../../src/inspect"
import { instrumentIncumbentLite } from "./evidence-plugin.mjs"
import { observer } from "./evidence-observer.mjs"

function thrown(fn: () => unknown): unknown {
    try {
        fn()
    } catch (error) {
        return error
    }
    throw Error("Expected failure")
}
function circular(error: unknown): SelectorCircularDependencyError {
    let current = error
    while (current && typeof current === "object") {
        if (current instanceof SelectorCircularDependencyError) return current
        current = (current as { cause?: unknown }).cause
    }
    throw Error("Missing exported cycle cause")
}

describe("fixed incumbent-lite ablation", () => {
    for (const [label, makeStore] of [
        ["ordinary", store],
        ["inspectable", () => createInspectableStore().store],
    ] as const) {
        test(`${label}: cached multi-hop closure fails and later recovers`, () => {
            const s = makeStore()
            const enabled = atom(false)
            const nodes: Selector<number>[] = []
            for (let i = 0; i < 4; i++)
                nodes.push(
                    selector(get =>
                        i === 0 && !get(enabled) ? 1 : get(nodes[(i + 1) % 4]!),
                    ),
                )
            try {
                expect(s.get(nodes[1]!)).toBe(1)
                s.set(enabled, true)
                const fault = circular(thrown(() => s.get(nodes[0]!)))
                expect(fault.path.length).toBe(5)
                expect(fault.path[0]).toBe(fault.path.at(-1))
                expect(new Set(fault.path.slice(0, -1)).size).toBe(4)
                s.set(enabled, false)
                expect(s.get(nodes[1]!)).toBe(1)
            } finally {
                s.dispose()
            }
        })
    }

    test("caught active cycles stay sticky and completed children survive", () => {
        const s = store()
        const leaf = atom(7)
        let entries = 0,
            laterEntries = 0
        const child = selector(get => {
            entries++
            return get(leaf)
        })
        const later = selector(() => ++laterEntries)
        let first: unknown, second: unknown
        const parent: Selector<number> = selector(get => {
            get(child)
            try {
                get(parent)
            } catch (error) {
                first = error
            }
            try {
                get(later)
            } catch (error) {
                second = error
            }
            return 99
        })
        try {
            expect(thrown(() => s.get(parent))).toBe(first)
            expect(second).toBe(first)
            expect(first).toBeInstanceOf(SelectorCircularDependencyError)
            expect(laterEntries).toBe(0)
            expect(s.get(child)).toBe(7)
            expect(entries).toBe(1)
        } finally {
            s.dispose()
        }
    })

    test("the fixed removal and candidate observation anchors are explicit", () => {
        const source = (path: string) =>
            readFileSync(
                new URL(`../../src/v1-internal/${path}`, import.meta.url),
                "utf8",
            )
        const evaluator = source("selector-evaluator/evaluate.ts")
        const types = source("selector-evaluator/types.ts")
        expect(evaluator).not.toMatch(
            /NewEdgeProofMemo|tryProveNoDependencyPathReverse|REVERSE_PROOF_MAX_WORK|captureTransientReverseDependents/,
        )
        expect(types).not.toMatch(
            /interface SelectorNewEdgeProofMemo|captureTransientReverseDependents|visitSelectorDependents/,
        )
        expect(evaluator).toContain("graphObservation?.takeAddedEdges()")
        expect(evaluator).toContain(
            "session.getTransientDependencies(host, node)",
        )
        expect(source("committed-store-tree/scope-node.ts")).toContain(
            "this.#reverseEdges.get(node)?.forEach",
        )
        for (const path of [
            "selector-evaluator/evaluate.ts",
            "committed-store-tree/scope-node.ts",
            "committed-store-tree/scratch-selector-host.ts",
            "committed-store-tree/committed-store-tree.ts",
        ]) {
            const original = source(path)
            expect(original).not.toContain("tournamentObserver")
            expect(
                instrumentIncumbentLite(original, `/v1-internal/${path}`),
            ).toContain("tournamentObserver")
        }
        expect(() =>
            instrumentIncumbentLite("", "/selector-evaluator/evaluate.ts"),
        ).toThrow("INCUMBENT-LITE-ADAPTER-ANCHOR")
    })

    test("counter snapshots reset measurements without discarding accepted records", () => {
        observer.reset()
        const host = {},
            node = {},
            dependency = {},
            token = {}
        observer.coordinate(host, "root")
        observer.install(host, node, {
            dependencies: [{ node: dependency }],
            served: { token, outcome: { kind: "value", value: 1 } },
        })
        observer.search(1)
        observer.count("canonicalNodeVisits", 3)
        const first = observer.snapshot()
        expect(first.common.dependencyEdgesAdded).toBe(1)
        expect(first.candidateSpecific.newEdgeSearches).toBe(1)
        observer.resetCounters()
        expect(observer.snapshot().candidateSpecific.canonicalNodeVisits).toBe(
            0,
        )
        expect(observer.snapshot().hosts[0].records.length).toBe(1)
        observer.clear(host)
        expect(observer.snapshot().common.dependencyEdgesRemoved).toBe(1)
        expect(observer.snapshot().candidateSpecific.reverseProofSearches).toBe(
            0,
        )
        observer.reset()
    })
})
