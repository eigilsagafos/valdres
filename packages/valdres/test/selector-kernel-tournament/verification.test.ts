import { test, expect } from "bun:test"
import { mkdtempSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { captureCommand } from "../../../../scripts/selector-kernel-tournament/artifact.mjs"
import {
    requireVerificationTotals,
    verificationTotals,
    EXPECTED_TESTS,
    verificationCommands,
} from "../../../../scripts/selector-kernel-tournament/verification.mjs"
import { validatePreflight } from "../../../../scripts/selector-kernel-tournament/timing-evidence.mjs"
import { manifest } from "../../../../scripts/selector-kernel-tournament/inputs.mjs"
test("F9 refuses incomplete CI or standalone tests even with a success status", () => {
    expect(() =>
        requireVerificationTotals("repository-ci", {
            bun: [],
            node: [],
            ciSteps: 1,
        }),
    ).toThrow("F9-CI")
    for (const [id, count] of Object.entries(EXPECTED_TESTS)) {
        expect(() =>
            requireVerificationTotals(id, {
                bun: [{ passed: count - 1, failed: 0 }],
                node: [],
                ciSteps: 0,
            }),
        ).toThrow("F9-TESTS")
        expect(() =>
            requireVerificationTotals(id, {
                bun: [],
                node: [{ passed: count, total: count + 1 }],
                ciSteps: 0,
            }),
        ).toThrow("F9-TESTS")
    }
})
test("F9 totals retain test cohorts and distinguish a resumed verifier", () => {
    expect(
        verificationTotals({
            stdout: " 8 pass\n 0 fail\n 25 expect() calls\nTests 8 passed (8)\nSteps 9–19 passed",
            stderr: "",
        }),
    ).toEqual({
        bun: [{ passed: 8, failed: 0 }],
        node: [{ passed: 8, total: 8 }],
        assertions: 25,
        ciSteps: 0,
    })
})
test("C preflight does not import A core-load or family admission rules", () => {
    const identity = { gitSha: "a".repeat(40), tarballSha256: "a".repeat(64) }
    const value = {
        schemaVersion: 3,
        stage: "C",
        gitSha: identity.gitSha,
        timedArtifactSha256: identity.tarballSha256,
        counterArtifactSha256: "b".repeat(64),
        family: null,
        core: null,
        rows: manifest.semanticCases
            .filter(r => r.requiredAt.includes("C"))
            .flatMap(r =>
                ["bun", "node"].flatMap(runtime =>
                    ["public", "counter"].map(mode => ({
                        id: r.id,
                        runtime,
                        mode,
                        status: "pass",
                        evidence: "semantic.json",
                        traceSha256: "c".repeat(64),
                    })),
                ),
            ),
    }
    expect(() => validatePreflight(value, "C", identity)).not.toThrow()
    expect(() =>
        validatePreflight(
            { ...value, family: { status: "pass", scoring: false } },
            "C",
            identity,
        ),
    ).toThrow("FAMILY-COMPATIBILITY")
})

test("F9 runs ordinary tests in Bun test mode and keeps source memory in production", () => {
    const rows = verificationCommands()
    for (const row of rows.filter(r => !r.id.startsWith("source-memory-"))) {
        expect(row.argv.slice(0, 3)).toEqual(["env", "-u", "NODE_ENV"])
    }
    for (const row of rows.filter(r => r.id.startsWith("source-memory-"))) {
        expect(row.argv).not.toContain("-u")
    }
    const directory = mkdtempSync(join(tmpdir(), "tournament-f9-mode-"))
    try {
        writeFileSync(
            join(directory, "mode.test.ts"),
            'import {test,expect} from "bun:test";test("development regressions stay enabled",()=>expect(process.env.NODE_ENV).toBe("test"));\n',
        )
        const production = captureCommand(
            ["bun", "test", "mode.test.ts"],
            directory,
        )
        expect(production.status).toBe(1)
        const ordinary = captureCommand(
            ["env", "-u", "NODE_ENV", "bun", "test", "mode.test.ts"],
            directory,
        )
        expect(ordinary.status).toBe(0)
    } finally {
        rmSync(directory, { recursive: true, force: true })
    }
})
