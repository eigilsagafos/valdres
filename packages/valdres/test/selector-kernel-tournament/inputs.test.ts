import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import {
    assertControl,
    checkInputs,
    manifest,
    ROOT,
    schemaCheck,
    validateInventoryRows,
    verifyMemorySource,
    verifyClaimIdentity,
} from "../../../../scripts/selector-kernel-tournament/inputs.mjs"

const copy = () => structuredClone(manifest)
// These are inventory-only fixtures, never eligible reports or timing evidence.
function rows(stage = "A") {
    return {
        candidate: {
            id: "reactive-currentness",
            stage,
            intendedWorkloads: ["P-FANOUT-128"],
        },
        semanticCases: manifest.semanticCases
            .filter(row => row.requiredAt.includes(stage))
            .flatMap(row =>
                ["bun", "node"].map(runtime => ({ id: row.id, runtime })),
            ),
        workloads: manifest.performanceWorkloads
            .filter(row => row.requiredAt.includes(stage))
            .flatMap(row =>
                row.runtimes.map(runtime => ({
                    id: row.id,
                    runtime,
                    baselineId: "beta36-control",
                    protected: true,
                    intended: row.id === "P-FANOUT-128",
                    decisions: {
                        protectedNonRegression: stage === "A" ? {} : null,
                        intendedWin:
                            stage === "A" && row.id === "P-FANOUT-128"
                                ? {}
                                : null,
                        pre28Claim: null,
                    },
                })),
            ),
        resources: {
            memory:
                stage === "C"
                    ? []
                    : manifest.memoryScenarios.flatMap(row =>
                          row.runtimes.map(runtime => ({
                              id: row.id,
                              runtime,
                              unitCount: row.units,
                              retainedBytesPerUnitCeiling:
                                  row.absoluteCeilings[runtime]
                                      .retainedBytesPerUnit,
                              releasedResidualBytesCeiling:
                                  row.absoluteCeilings[runtime]
                                      .releasedResidualBytes,
                          })),
                      ),
        },
        comparisonBaselines: { pre28Claim: null },
        gates: { shiftx: { status: "not-run" } },
    }
}
describe("F0 frozen authority", () => {
    test("v2 scope cannot regress to legacy async/global or synthetic hydration", () => {
        expect(manifest.schemaVersion).toBe(2)
        expect(manifest.id).toBe("valdres-selector-kernel-tournament-v2")
        expect(manifest.semanticCases).toHaveLength(30)
        expect(manifest.performanceWorkloads).toHaveLength(17)
        expect(manifest.memoryScenarios).toHaveLength(6)
        expect(rows().resources.memory).toHaveLength(12)
        const fault = manifest.semanticCases.find(
            row => row.id === "A-FAULT-001",
        )!
        expect(fault.parameters.thenablePhases).toEqual([
            "getter-return",
            "getter-throw",
            "comparator-return",
            "comparator-throw",
        ])
        expect(fault.parameters.maySettleIntoState).toBe(false)
        const hydration = manifest.semanticCases.find(
            row => row.id === "A-HYDRATE-001",
        )!
        expect(hydration.parameters).toEqual({
            api: "readHydrationSnapshot(store,state)",
            externalProjection: false,
            missingServerReader: false,
            liveSelectorPublication: false,
        })
        for (const [collection, id] of [
            ["semanticCases", "A-ASYNC-001"],
            ["performanceWorkloads", "P-ASYNC-SETTLE-OBSERVED"],
            ["memoryScenarios", "M-GLOBAL-FANOUT"],
            ["memoryScenarios", "M-STORE-DISPOSAL-ASYNC-CANCELLATION"],
        ] as const) {
            const changed = copy()
            changed[collection][0].id = id
            expect(() => schemaCheck(changed, "manifest")).toThrow(
                "INPUT-SCHEMA",
            )
            const report = rows()
            const target =
                collection === "semanticCases"
                    ? report.semanticCases
                    : collection === "performanceWorkloads"
                      ? report.workloads
                      : report.resources.memory
            target[0].id = id
            expect(() => validateInventoryRows(report)).toThrow("unknown row")
        }
        const changed = copy()
        changed.schemaVersion = 1
        expect(() => schemaCheck(changed, "manifest")).toThrow("INPUT-SCHEMA")
    })
    test("all hashes, schema, control lineage, memory and size match", () =>
        expect(checkInputs().specGitSha).toBe(
            "20dddc5c307a1213f3888ab0dabc60a59a165b36",
        ))
    test.each(["id", "parameter", "duplicate", "unknown-field"])(
        "reject inventory %s mutation",
        mutation => {
            const data = copy()
            if (mutation === "id") data.semanticCases[0].id = "unknown"
            if (mutation === "parameter")
                data.performanceWorkloads[0].parameters.atoms++
            if (mutation === "duplicate")
                data.semanticCases.push(data.semanticCases[0])
            if (mutation === "unknown-field") data.extra = true
            expect(() => schemaCheck(data, "manifest")).toThrow("INPUT-SCHEMA")
        },
    )
    test("spec hash is verified independently", () => {
        const data = copy()
        data.spec.sha256 = "0".repeat(64)
        expect(() => checkInputs(ROOT, data)).toThrow("INPUT-SPEC-HASH")
    })
    test("wrong control tree fails", () =>
        expect(() => assertControl("0".repeat(40))).toThrow(
            "INPUT-CONTROL-TREE",
        ))
    test("memory source ceiling drift fails", () => {
        const source = readFileSync(
            resolve(ROOT, manifest.memoryScenarios[0].sourceTest),
            "utf8",
        ).replace("retainedBytesPerUnit: 160", "retainedBytesPerUnit: 161")
        expect(() => verifyMemorySource(source)).toThrow("INPUT-MEMORY-CEILING")
    })
    test("memory source unit drift fails", () => {
        const source = readFileSync(
            resolve(ROOT, manifest.memoryScenarios[0].sourceTest),
            "utf8",
        ).replace("length: 4_000", "length: 4_001")
        expect(() => verifyMemorySource(source)).toThrow("INPUT-MEMORY-UNITS")
    })
    test.each(["C", "A"])("complete %s inventory", stage =>
        expect(() => validateInventoryRows(rows(stage))).not.toThrow(),
    )
    test.each(["unknown", "duplicate", "family", "memory", "pre28"])(
        "reject report %s mutation",
        mutation => {
            const data = rows()
            let gate = "REPORT-TIMING-ROWS"
            if (mutation === "unknown") data.workloads[0].id = "unknown"
            if (mutation === "duplicate") data.workloads.push(data.workloads[0])
            if (mutation === "family") {
                data.workloads[0].decisions.intendedWin = {}
                gate = "REPORT-TEST-FAMILY"
            }
            if (mutation === "memory") {
                data.resources.memory.pop()
                gate = "REPORT-MEMORY-ROWS"
            }
            if (mutation === "pre28") {
                data.candidate.stage = "shiftx"
                data.workloads.push({
                    id: "X-SINGLE-DECISION-DROP",
                    runtime: "chrome",
                    baselineId: "pre28-claim",
                })
                gate = "REPORT-PRE28-AUTH"
            }
            expect(() => validateInventoryRows(data)).toThrow(gate)
        },
    )
    test("unauthenticated external baseline fails before file access", () =>
        expect(() => verifyClaimIdentity({}, "/not-an-artifact")).toThrow(
            "INPUT-PRE28-IDENTITY",
        ))
    test("report schema closes fields and candidate IDs", () =>
        expect(() => schemaCheck({ unknown: true })).toThrow("INPUT-SCHEMA"))
})
