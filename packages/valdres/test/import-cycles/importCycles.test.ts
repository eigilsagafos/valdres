import { expect, test } from "bun:test"
import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import {
    buildImportGraph,
    computeSccs,
    extractImportSpecifiers,
    findCycleInScc,
    findNewOrGrownSccs,
    type ImportGraph,
} from "./importGraph"

/**
 * Import-boundary guard for the core production module graph.
 *
 * A committed baseline (importCycles.baseline.json) records the strongly-
 * connected components (runtime import cycles) that exist today. This test
 * FAILS a change that:
 *   - introduces a brand-new cycle (a new SCC), or
 *   - worsens an existing one (an SCC that gains a module, or two separate
 *     cycles that merge into a bigger one).
 *
 * It deliberately does NOT require existing cycles to be eliminated — the core
 * has one large historical SCC and untangling it is out of scope. Shrinking or
 * removing cycles is always allowed (and, once done, the baseline can be
 * tightened by regenerating it).
 *
 * The rule: every CURRENT multi-module SCC must be a subset of some single
 * BASELINE SCC. Any current SCC with a member outside every baseline SCC it
 * overlaps — or that spans two baseline SCCs — is new or grown, and fails with
 * a concrete, actionable cycle path.
 *
 * Regenerate after an intentional, reviewed change to the cycle structure:
 *   UPDATE_CYCLE_BASELINE=1 bun test test/import-cycles/importCycles.test.ts
 */

const BASELINE_PATH = resolve(import.meta.dir, "importCycles.baseline.json")

type Baseline = {
    moduleCount: number
    edgeCount: number
    sccs: string[][]
}

const loadBaseline = (): Baseline =>
    JSON.parse(readFileSync(BASELINE_PATH, "utf8"))

const writeBaseline = (graph: ImportGraph, sccs: string[][]) => {
    let edgeCount = 0
    for (const [, edges] of graph) edgeCount += edges.length
    const baseline = {
        note:
            "Import-cycle baseline for valdres core production modules. " +
            "Regenerate with UPDATE_CYCLE_BASELINE=1 bun test " +
            "test/import-cycles/importCycles.test.ts. The guard fails only when " +
            "a change introduces a NEW cycle or GROWS an existing SCC — see " +
            "importCycles.test.ts. Existing cycles are recorded, not required " +
            "to be eliminated.",
        moduleCount: graph.size,
        edgeCount,
        sccs,
    }
    writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 4) + "\n")
}

test("no new or worsened production import cycles", () => {
    const graph = buildImportGraph()
    const sccs = computeSccs(graph)

    if (process.env.UPDATE_CYCLE_BASELINE === "1") {
        writeBaseline(graph, sccs)
        return
    }

    // Non-vacuity: if module discovery silently broke, the whole guard would
    // pass trivially. Anchor to the module count captured in the baseline.
    const baseline = loadBaseline()
    expect(graph.size).toBeGreaterThan(Math.floor(baseline.moduleCount * 0.5))

    const offenders = findNewOrGrownSccs(sccs, baseline.sccs).map(scc => {
        const cycle = findCycleInScc(scc, graph)
            .map(module => module.replace(/^src\//, ""))
            .join("\n     -> ")
        return (
            `New or grown import cycle (${scc.length} modules):\n` +
            `  cycle: ${cycle}\n` +
            `  members: ${scc.map(m => m.replace(/^src\//, "")).join(", ")}`
        )
    })

    if (offenders.length > 0) {
        throw new Error(
            `Import-boundary guard failed — ${offenders.length} new/worsened ` +
                `cycle(s) detected.\n\n${offenders.join("\n\n")}\n\n` +
                `Break the cycle above, or — if this coupling is intentional ` +
                `and reviewed — regenerate the baseline with ` +
                `UPDATE_CYCLE_BASELINE=1 bun test ` +
                `test/import-cycles/importCycles.test.ts`,
        )
    }
})

test("current main introduces no new or grown cycles vs the baseline", () => {
    // Regenerating the baseline off an unmodified tree yields the same SCCs, so
    // main is trivially clean — but assert it through the SAME guard predicate
    // so the check stays meaningful. NOT an exact-equality gate: shrinking or
    // removing a cycle (a subset of a baseline SCC) must never fail CI.
    const graph = buildImportGraph()
    const sccs = computeSccs(graph)
    const baseline = loadBaseline()
    expect(findNewOrGrownSccs(sccs, baseline.sccs)).toEqual([])
})

test("shrinking or removing a cycle passes the guard (subset is allowed)", () => {
    // Regression for the improvement-blocking exact-equality gate: a baseline
    // SCC [a,b,c] with a current SCC that dropped a module to [a,b] is an
    // improvement and must produce no offenders.
    const baselineSccs = [["a", "b", "c"]]
    expect(findNewOrGrownSccs([["a", "b"]], baselineSccs)).toEqual([])
    // A fully removed cycle (no current SCC at all) is likewise clean.
    expect(findNewOrGrownSccs([], baselineSccs)).toEqual([])
    // But a grown SCC (gains a member) and a brand-new one are both flagged.
    expect(findNewOrGrownSccs([["a", "b", "c", "d"]], baselineSccs)).toEqual([
        ["a", "b", "c", "d"],
    ])
    expect(findNewOrGrownSccs([["x", "y"]], baselineSccs)).toEqual([["x", "y"]])
})

test("side-effect and self imports create graph edges (regression)", () => {
    // Finding 4: `import "./b"` (no `from`) and self-imports must be edges.
    expect(extractImportSpecifiers(`import "./register"`)).toEqual([
        "./register",
    ])
    const specs = extractImportSpecifiers(
        `import "./side"\nimport { x } from "./named"\nimport type { T } from "./types"`,
    )
    expect(specs).toContain("./side") // side-effect edge kept
    expect(specs).toContain("./named") // value import kept
    expect(specs).not.toContain("./types") // type-only erased

    // A side-effect import cycle: a.ts `import "./b"`, b.ts `import { x } from "./a"`.
    const aSpecs = extractImportSpecifiers(`import "./b"`)
    const bSpecs = extractImportSpecifiers(`import { x } from "./a"`)
    expect(aSpecs).toContain("./b")
    expect(bSpecs).toContain("./a")
    const graph: ImportGraph = new Map([
        ["a.ts", ["b.ts"]],
        ["b.ts", ["a.ts"]],
    ])
    const sccs = computeSccs(graph)
    expect(sccs).toHaveLength(1)
    expect([...sccs[0]!].sort()).toEqual(["a.ts", "b.ts"])
    // Actionable path returned for reporting.
    const cyclePath = findCycleInScc(sccs[0]!, graph)
    expect(cyclePath.length).toBeGreaterThanOrEqual(3)
    expect(cyclePath[0]).toBe(cyclePath[cyclePath.length - 1])

    // A self-loop is retained and reported as a single-node cycle.
    const selfGraph: ImportGraph = new Map([["s.ts", ["s.ts"]]])
    const selfSccs = computeSccs(selfGraph)
    expect(selfSccs).toEqual([["s.ts"]])
})
