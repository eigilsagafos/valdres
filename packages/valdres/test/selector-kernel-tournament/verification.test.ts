import { test, expect } from "bun:test"
import {
    requireVerificationTotals,
    verificationTotals,
    EXPECTED_TESTS,
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
