import { expect, test } from "bun:test"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
    manifest,
    json,
    ROOT,
} from "../../../../scripts/selector-kernel-tournament/inputs.mjs"
import {
    validateWorkloadExpectations,
    validateWorkloadSample,
} from "../../../../scripts/selector-kernel-tournament/workload-validation.mjs"
import { buildLegacyWrappers } from "../../../../scripts/selector-kernel-tournament/legacy-wrappers.mjs"
const expectations = json(
    join(
        ROOT,
        "packages/valdres/test/selector-kernel-tournament/workload-expectations.v3.json",
    ),
)
test("frozen corpus is complete and no-writes retains all 900 lifecycle steps", () => {
    expect(() =>
        validateWorkloadExpectations(expectations, manifest),
    ).not.toThrow()
    const core = expectations.rows.find(r => r.id === "P-CORE-NO-WRITES")
    expect(core.counts.renderReads).toBe(150 + 900 * 8 * 6)
    expect(core.counts.timedUnsubscriptions).toBe(900 * 8 * 6)
    const missing = structuredClone(expectations)
    missing.rows.pop()
    expect(() => validateWorkloadExpectations(missing, manifest)).toThrow(
        "WORKLOAD-EXPECTATIONS",
    )
    const unknown = structuredClone(expectations)
    unknown.rows[0].counts.unknown = 1
    expect(() => validateWorkloadExpectations(unknown, manifest)).toThrow(
        "WORKLOAD-WORK-COUNT",
    )
})
test("bad work or checksum is rejected before statistics", () => {
    const row = manifest.performanceWorkloads[0],
        expected = expectations.rows[0]
    const input = {
        row,
        runtime: "node",
        mode: "timed",
        expected,
        entrySha256: "1".repeat(64),
    }
    const sample = {
        schemaVersion: 3,
        kind: "workload-process",
        runtime: "node",
        pid: 1,
        entrySha256: input.entrySha256,
        id: row.id,
        mode: "timed",
        durationNs: 10000,
        counts: expected.counts,
        checksum: expected.checksum,
        common: null,
        candidateSpecific: null,
        core: null,
    }
    expect(() => validateWorkloadSample(sample, input)).not.toThrow()
    expect(() =>
        validateWorkloadSample(
            { ...sample, counts: { ...sample.counts, set: 2559 } },
            input,
        ),
    ).toThrow("WORKLOAD-WORK-COUNT")
    expect(() =>
        validateWorkloadSample({ ...sample, checksum: "0".repeat(64) }, input),
    ).toThrow("WORKLOAD-CHECKSUM")
    expect(() =>
        validateWorkloadSample({ ...sample, extra: true }, input),
    ).toThrow("WORKLOAD-SCHEMA")
    expect(() =>
        validateWorkloadSample({ ...sample, common: {} }, input),
    ).toThrow("ARTIFACT-INSTRUMENTATION")
})
test("legacy wrappers preserve benchmark bodies and GC protocol without importing legacy runtimes", () => {
    const directory = mkdtempSync(join(tmpdir(), "tournament-port-"))
    try {
        const output = join(directory, "wrappers.mjs")
        const inputs = buildLegacyWrappers(output),
            source = readFileSync(output, "utf8")
        expect(Object.keys(inputs.sources)).toHaveLength(4)
        expect(source).toContain("length: 1000")
        expect(source).toContain("depth < 20")
        expect(source).toContain("settleAndCollect")
        expect(source.match(/explicitGC\(\)/g)?.length).toBe(3)
        expect(source).not.toContain("/src/")
        expect(source).not.toContain("jotai")
    } finally {
        rmSync(directory, { recursive: true, force: true })
    }
})
