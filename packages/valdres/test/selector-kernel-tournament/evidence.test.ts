import { isolatedTournamentFile } from "./self-test-context.mjs"

if (isolatedTournamentFile()) {
    const { test, expect } = await import("bun:test")
    const { mkdtempSync, rmSync, writeFileSync, symlinkSync } = await import(
        "node:fs"
    )
    const { tmpdir } = await import("node:os")
    const { join } = await import("node:path")
    const {
        writeEvidence,
        sealEvidence,
        verifySeal,
        evidencePath,
        same,
        strictKeys,
    } = await import(
        "../../../../scripts/selector-kernel-tournament/evidence.mjs"
    )
    const { manifest } = await import(
        "../../../../scripts/selector-kernel-tournament/inputs.mjs"
    )
    const {
        freezePlan,
        verifyFrozenPlan,
        validatePlan,
        requireStableEnvironment,
    } = await import(
        "../../../../scripts/selector-kernel-tournament/provenance.mjs"
    )
    const { validateProcess } = await import(
        "../../../../scripts/selector-kernel-tournament/process-evidence.mjs"
    )
    const { computeSelection, validateControlShape } = await import(
        "../../../../scripts/selector-kernel-tournament/report.mjs"
    )
    const { memoryProcessSummary, decideSizes } = await import(
        "../../../../scripts/selector-kernel-tournament/resource-validation.mjs"
    )
    function temporary(body) {
        const root = mkdtempSync(join(tmpdir(), "tournament-evidence-test-"))
        try {
            body(root)
        } finally {
            rmSync(root, { recursive: true, force: true })
        }
    }
    const processRecord = () => ({
        argv: ["node", "worker.mjs"],
        cwd: "/recorded",
        environment: { PATH: "/bin", NODE_ENV: "production", FORCE_COLOR: "0" },
        pid: 7,
        startedAt: "2026-09-04T10:00:00.000Z",
        endedAt: "2026-09-04T10:00:01.000Z",
        status: 0,
        signal: null,
        error: null,
        stdout: "{}\n",
        stderr: "",
    })
    test("complete seals bind bytes, membership, and the external SHA256SUMS identity", () =>
        temporary(root => {
            writeEvidence(root, "raw/a.json", { sample: 1 })
            writeEvidence(root, "raw/b.json", { sample: 2 })
            const hash = sealEvidence(root)
            expect(verifySeal(root, hash)).toHaveLength(2)
            expect(() => writeEvidence(root, "later.json", {})).toThrow(
                "EVIDENCE-IMMUTABLE",
            )
            writeFileSync(join(root, "raw/a.json"), "tampered")
            expect(() => verifySeal(root, hash)).toThrow("EVIDENCE-HASH")
            writeFileSync(
                join(root, "SHA256SUMS"),
                "0".repeat(64) + "  raw/a.json\n",
            )
            expect(() => verifySeal(root, hash)).toThrow("EVIDENCE-SUMS-HASH")
        }))
    test("unknown files, duplicate sum rows, traversal, symlinks, and unknown object fields fail closed", () =>
        temporary(root => {
            writeEvidence(root, "a.json", {})
            sealEvidence(root)
            writeFileSync(join(root, "extra.json"), "{}")
            expect(() => verifySeal(root)).toThrow("EVIDENCE-MEMBERSHIP")
            for (const path of [
                "/absolute",
                "../escape",
                "a/../b",
                "a\\b",
                "a//b",
                "a\nline",
            ])
                expect(() => evidencePath(root, path)).toThrow("EVIDENCE-PATH")
            symlinkSync("/tmp", join(root, "link"))
            expect(() => evidencePath(root, "link/file")).toThrow(
                "EVIDENCE-SYMLINK",
            )
            expect(() =>
                strictKeys({ known: 1, extra: 2 }, ["known"], "TEST-SCHEMA"),
            ).toThrow("TEST-SCHEMA")
        }))
    test("declared intent is immutable and removed workload IDs cannot be declared", () =>
        temporary(root => {
            const plan = {
                schemaVersion: 3,
                kind: "candidate",
                id: "reactive-currentness",
                revision: 1,
                stage: "C",
                gitSha: "a".repeat(40),
                intendedWorkloads: ["P-FANOUT-128"],
                algorithmicConstants: [],
            }
            const artifact = freezePlan(root, plan)
            expect(verifyFrozenPlan(root, artifact)).toEqual(plan)
            writeFileSync(
                join(root, artifact.path),
                JSON.stringify({
                    ...plan,
                    intendedWorkloads: ["P-FANOUT-512"],
                }),
            )
            expect(() => verifyFrozenPlan(root, artifact)).toThrow(
                "PROVENANCE-INTENT-HASH",
            )
            expect(() =>
                validatePlan({
                    ...plan,
                    intendedWorkloads: ["P-ASYNC-SETTLE-OBSERVED"],
                }),
            ).toThrow("PLAN-INTENT")
            expect(() =>
                validatePlan({
                    ...plan,
                    kind: "control",
                    id: "beta36-control",
                    gitSha: manifest.control.gitSha,
                }),
            ).toThrow("PLAN-CONTROL")
        }))
    test("exact invocation, runtime environment, PID and full UTC process evidence are required", () => {
        const good = processRecord()
        expect(() => validateProcess(good, { argv: good.argv })).not.toThrow()
        expect(() =>
            validateProcess(
                {
                    ...good,
                    argv: ["node", "--import", "cheat.mjs", "worker.mjs"],
                },
                { argv: good.argv },
            ),
        ).toThrow("PROVENANCE-INVOCATION")
        expect(() =>
            validateProcess({
                ...good,
                environment: {
                    ...good.environment,
                    NODE_OPTIONS: "--import cheat.mjs",
                },
            }),
        ).toThrow("PROVENANCE-ENVIRONMENT")
        expect(() => validateProcess({ ...good, pid: null })).toThrow(
            "PROVENANCE-PROCESS-SCHEMA",
        )
        expect(() => validateProcess({ ...good, status: 1 })).toThrow(
            "PROVENANCE-PROCESS-FAILED",
        )
    })
    test("power loss, a thermal transition or another benchmark invalidate the entire lane", () => {
        const before = {
            at: "2026-09-04T10:00:01.000Z",
            power: {
                ...processRecord(),
                stdout: "Now drawing from 'AC Power'",
            },
            thermal: { ...processRecord(), stdout: "No warning" },
            processes: processRecord(),
            inventory: {
                ...processRecord(),
                argv: ["ps", "-axo", "pid=,ppid=,args="],
                stdout: "1 0 launchd\n42 1 bun control-bundle.mjs\n",
            },
            observerPid: 42,
            competing: [],
        }
        expect(() => requireStableEnvironment(before, before)).not.toThrow()
        expect(() =>
            requireStableEnvironment(before, {
                ...before,
                power: { ...before.power, stdout: "Battery Power" },
            }),
        ).toThrow("ENVIRONMENT-INVALIDATED")
        expect(() =>
            requireStableEnvironment(before, {
                ...before,
                thermal: { ...before.thermal, stdout: "Warning" },
            }),
        ).toThrow("ENVIRONMENT-INVALIDATED")
        expect(() =>
            requireStableEnvironment(before, {
                ...before,
                competing: [{ pid: 42 }],
            }),
        ).toThrow("PROVENANCE-ENVIRONMENT")
    })
    test("recorded gates alone determine advancement; reviewer or human enthusiasm cannot rescue a failure", () => {
        const gates = Object.fromEntries(
            [
                "provenance",
                "contractC",
                "contractA",
                "familyCompatibility",
                "performance",
                "p95",
                "memory",
                "sourceMemory",
                "size",
                "shiftx",
            ].map(k => [k, { status: "pass" }]),
        )
        expect(computeSelection(gates, "A").machineEligible).toBe(true)
        gates.performance.status = "inconclusive"
        expect(computeSelection(gates, "A").machineVerdict).toBe("inconclusive")
        expect(() =>
            computeSelection(gates, "A", { decision: "promote" }),
        ).toThrow("REPORT-HUMAN-OVERRIDE")
        gates.performance.status = "fail"
        expect(
            computeSelection(gates, "A", { decision: "hold" }).machineEligible,
        ).toBe(false)
        gates.performance.status = "pass"
        gates.shiftx.status = "not-run"
        expect(computeSelection(gates, "shiftx").machineVerdict).toBe(
            "not-complete",
        )
        expect(() =>
            validateControlShape({
                kind: "foundation-control",
                selection: { machineEligible: true },
            }),
        ).toThrow("REPORT-CONTROL-SCHEMA")
    })
    test("retained-memory and every raw/gzip size gate preserve absolute and relative thresholds", () => {
        const scenario = manifest.memoryScenarios[0]
        const sample = {
            schemaVersion: 3,
            kind: "memory-process",
            id: scenario.id,
            runtime: "node",
            pid: 1,
            unitCount: scenario.units,
            samplerCalibration: {
                kind: "empty-sampler",
                publicOperations: 0,
                samples: Array.from({ length: 3 }, () => ({
                    before: 1000,
                    retainedHeap: 1000,
                    releasedHeaps: [1000, 1000, 1000],
                })),
            },
            samples: Array.from({ length: 3 }, () => ({
                before: 1000000,
                retainedHeap: 1000000 + scenario.units * 100,
                releasedHeaps: [1000010, 1000005, 1000000],
            })),
        }
        expect(memoryProcessSummary(sample).absolutePass).toBe(true)
        for (const row of sample.samples)
            row.releasedHeaps = [1000001, 1000002, 1000003]
        expect(memoryProcessSummary(sample).absolutePass).toBe(true)
        const base = {
                root: { raw: 10000, gzip: 5000 },
                packed: { raw: 20000, gzip: 6000 },
            },
            head = structuredClone(base)
        head.root.gzip = 5101
        expect(
            decideSizes(base, head, base).find(
                r => r.id === "root" && r.unit === "gzip",
            ).status,
        ).toBe("fail")
        delete head.packed
        expect(() => decideSizes(base, head, base)).toThrow("SIZE-METRICS")
    })

    test("raw size parsing retains each metric and rejects rehashed baseline substitutions", async () => {
        const { parseSizeOutput, normalizeSizes } = await import(
            "../../../../scripts/selector-kernel-tournament/resource-evidence.mjs"
        )
        const { frozenInputJson } = await import(
            "../../../../scripts/selector-kernel-tournament/inputs.mjs"
        )
        const baseline = frozenInputJson(manifest.stages.size.baselineFile)
        const text = [
            "Measured sizes (bytes):",
            `  dist total raw ${baseline.dist.raw} gzip ${baseline.dist.gzip}`,
            ...Object.entries(baseline.distFiles).map(
                ([name, size]) => `  ${name} raw ${size.raw} gzip ${size.gzip}`,
            ),
            `  packed package raw ${baseline.packed.raw} gzip ${baseline.packed.gzip}`,
            ...Object.entries(baseline.fixtures).map(
                ([name, size]) =>
                    `  fixture ${name} raw ${size.raw} gzip ${size.gzip}`,
            ),
        ].join("\n")
        expect(normalizeSizes(parseSizeOutput(text))).toEqual(
            normalizeSizes(baseline),
        )
        expect(Object.keys(normalizeSizes(baseline))).toHaveLength(19)
        expect(() =>
            parseSizeOutput(text + "\n  dist total raw 1 gzip 1"),
        ).toThrow("SIZE-METRICS")
    })
}
