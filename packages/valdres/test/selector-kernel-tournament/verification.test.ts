import { isolatedTournamentFile } from "./self-test-context.mjs"

if (isolatedTournamentFile()) {
    const { test, expect } = await import("bun:test")
    const { mkdtempSync, writeFileSync, rmSync } = await import("node:fs")
    const { tmpdir } = await import("node:os")
    const { join } = await import("node:path")
    const { captureCommand } = await import(
        "../../../../scripts/selector-kernel-tournament/artifact.mjs"
    )
    const {
        requireVerificationTotals,
        verificationTotals,
        EXPECTED_TESTS,
        verificationCommands,
    } = await import(
        "../../../../scripts/selector-kernel-tournament/verification.mjs"
    )
    const { validatePreflight } = await import(
        "../../../../scripts/selector-kernel-tournament/timing-evidence.mjs"
    )
    const { manifest } = await import(
        "../../../../scripts/selector-kernel-tournament/inputs.mjs"
    )
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
        const identity = {
            gitSha: "a".repeat(40),
            tarballSha256: "a".repeat(64),
        }
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
        for (const row of rows.filter(
            r => !r.id.startsWith("source-memory-"),
        )) {
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

    test("isolated test dispatcher records complete child counts separately", async () => {
        const { validateSelfTestResult } = await import(
            "./self-test-context.mjs"
        )
        const value = {
            status: 0,
            signal: null,
            error: null,
            stdout: "",
            stderr: " 2 pass\n 0 fail\n 7 expect() calls\nRan 2 tests across 1 file. [1s]",
        }
        expect(validateSelfTestResult(value, { tests: 2, files: 1 })).toEqual({
            caseTests: 2,
            files: 1,
            assertions: 7,
        })
    })
    test("isolated test dispatcher rejects failures, omitted cases, skips and crashes", async () => {
        const { validateSelfTestResult } = await import(
            "./self-test-context.mjs"
        )
        const value = {
            status: 0,
            signal: null,
            error: null,
            stdout: "",
            stderr: " 2 pass\n 0 fail\nRan 2 tests across 1 file.",
        }
        for (const bad of [
            { ...value, status: 1 },
            { ...value, signal: "SIGTERM" },
            { ...value, error: "timeout" },
            { ...value, stderr: value.stderr.replace("2 pass", "1 pass") },
            {
                ...value,
                stderr: value.stderr.replace("0 fail", "1 skip\n 0 fail"),
            },
            { ...value, stderr: value.stderr.replace("1 file", "2 files") },
            { ...value, stderr: value.stderr + "\n" + value.stderr },
        ])
            expect(() =>
                validateSelfTestResult(bad, { tests: 2, files: 1 }),
            ).toThrow("TOURNAMENT-SELF-TESTS")
    })

    test("red, F9 and family proofs bind the authenticated source invocation context", async () => {
        const { ROOT, fileHash, frozenInputBytes, sha256 } = await import(
            "../../../../scripts/selector-kernel-tournament/inputs.mjs"
        )
        const { writeEvidence, sealEvidence } = await import(
            "../../../../scripts/selector-kernel-tournament/evidence.mjs"
        )
        const { validateRedProcesses } = await import(
            "../../../../scripts/selector-kernel-tournament/red-validation.mjs"
        )
        const { validateVerificationBundle } = await import(
            "../../../../scripts/selector-kernel-tournament/verification.mjs"
        )
        const { validateFamily } = await import(
            "../../../../scripts/selector-kernel-tournament/preflight.mjs"
        )
        const root = mkdtempSync(join(tmpdir(), "tournament-recorded-context-"))
        try {
            // These are protocol fixtures, not executed CI or family evidence.
            expect(() =>
                validateRedProcesses(
                    root,
                    { authorityRoot: "/unrelated" },
                    ROOT,
                ),
            ).toThrow("RED-AUTHORITY")
            const frozen = "1".repeat(40)
            writeEvidence(root, "verification.json", {
                schemaVersion: 3,
                kind: "foundation-verification",
                foundationSha: frozen,
                authorityRoot: "/unrelated",
                status: "pass",
                commands: [],
                reviews: {},
                limitations: {},
            })
            const files = manifest.productLanes.family.protectedPaths
                .filter(p => p.endsWith(".test.ts"))
                .map(path => ({ path, sha256: sha256(frozenInputBytes(path)) }))
            const process = {
                argv: [
                    "bun",
                    "test",
                    "--reporter=dots",
                    ...files.map(r => join(ROOT, r.path)),
                ],
                cwd: join(ROOT, "packages/valdres"),
                environment: { NODE_ENV: "production", FORCE_COLOR: "0" },
                pid: 7,
                startedAt: "2026-09-05T00:00:00.000Z",
                endedAt: "2026-09-05T00:00:01.000Z",
                status: 0,
                signal: null,
                error: null,
                stdout: "",
                stderr: "58 pass\n0 fail\n",
            }
            writeEvidence(root, "family.json", {
                status: "pass",
                scoring: false,
                files,
                process: "family.process.json",
            })
            writeEvidence(root, "family.process.json", process)
            expect(() => validateFamily(root, "family.json")).not.toThrow()
            writeFileSync(
                join(root, "family.process.json"),
                JSON.stringify({
                    ...process,
                    cwd: "/unrelated/packages/valdres",
                }),
            )
            expect(() => validateFamily(root, "family.json")).toThrow(
                "PROVENANCE-INVOCATION",
            )
            const sums = sealEvidence(root)
            expect(() =>
                validateVerificationBundle(root, sums, frozen, ROOT),
            ).toThrow("F9-AUTHORITY")
            expect(fileHash(join(root, "SHA256SUMS"))).toBe(sums)
        } finally {
            rmSync(root, { recursive: true, force: true })
        }
    })
}
