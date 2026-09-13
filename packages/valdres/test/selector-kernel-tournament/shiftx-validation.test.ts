import { isolatedTournamentFile } from "./self-test-context.mjs"

if (isolatedTournamentFile()) {
    const { test, expect } = await import("bun:test")
    const { mkdtempSync, rmSync, writeFileSync } = await import("node:fs")
    const { execFileSync } = await import("node:child_process")
    const { tmpdir } = await import("node:os")
    const { join } = await import("node:path")
    const { manifest, schemaCheck, ROOT, fileHash, sha256 } = await import(
        "../../../../scripts/selector-kernel-tournament/inputs.mjs"
    )
    const {
        profileTimeline,
        interactionDuration,
        decideShiftx,
        validateShiftx,
    } = await import(
        "../../../../scripts/selector-kernel-tournament/shiftx.mjs"
    )
    const {
        PRESERVED_RESEARCH_CANDIDATES,
        runShiftxResearch,
        validateRecordedContractC,
        validateReplayIdentity,
        validateReplayReview,
        validateShiftxResearchAdmission,
        validateShiftxResearchReport,
    } = await import(
        "../../../../scripts/selector-kernel-tournament/shiftx-research.mjs"
    )
    const { recomputeReport } = await import(
        "../../../../scripts/selector-kernel-tournament/report.mjs"
    )
    const { validatePriorStage } = await import(
        "../../../../scripts/selector-kernel-tournament/transitions.mjs"
    )
    const { sealEvidence } = await import(
        "../../../../scripts/selector-kernel-tournament/evidence.mjs"
    )
    const { artifactIdentity } = await import(
        "../../../../scripts/selector-kernel-tournament/artifact-validation.mjs"
    )
    const lanes = (ratio = 1, pairs = 8) =>
        manifest.shiftxWorkloads.map(row => ({
            id: row.id,
            samples: Array.from({ length: pairs }, (_, i) => ({
                pairId: String(i),
                baseNs: 1000000 + i * 100,
                headNs: (1000000 + i * 100) * ratio,
            })),
        }))
    const hash = (digit = "a") => digit.repeat(64)
    const admission = (performanceStatus = "fail") => ({
        candidateId: "reactive-currentness",
        contractC: {
            bundle: {
                path: "/recorded/contract-c",
                sha256sums:
                    PRESERVED_RESEARCH_CANDIDATES["reactive-currentness"]
                        .contractCSha256sums,
            },
            candidateIdentity: {
                id: "reactive-currentness",
                gitSha: PRESERVED_RESEARCH_CANDIDATES["reactive-currentness"]
                    .gitSha,
                diffSha256:
                    PRESERVED_RESEARCH_CANDIDATES["reactive-currentness"]
                        .diffSha256,
            },
            provenanceStatus: "pass",
            publicSemantics: manifest.semanticCases
                .filter(row => row.requiredAt.includes("C"))
                .flatMap(row =>
                    ["bun", "node"].map(runtime => ({
                        id: row.id,
                        runtime,
                        status: "pass",
                        evidence: `conformance-c-${runtime}.json`,
                    })),
                ),
            diagnostics: {
                performance: {
                    status: performanceStatus,
                    rows: [{ ratio: 1.1 }],
                },
                p95: { status: "not-run", rows: [{ ratio: 1.1 }] },
                memory: { status: "inconclusive", rows: [{ bytes: 1234 }] },
                size: { status: "fail", rows: [{ gzipBytes: 5678 }] },
            },
        },
        source: {
            gitSha: PRESERVED_RESEARCH_CANDIDATES["reactive-currentness"]
                .gitSha,
            diffSha256:
                PRESERVED_RESEARCH_CANDIDATES["reactive-currentness"]
                    .diffSha256,
        },
        replay: {
            baseGitSha: "a".repeat(40),
            gitSha: "b".repeat(40),
            diffSha256:
                PRESERVED_RESEARCH_CANDIDATES["reactive-currentness"]
                    .diffSha256,
            review: { path: "replay-review.json", sha256: hash("6") },
        },
        execution: {
            candidateOrder: [
                "incumbent-lite",
                "reactive-currentness",
                "dynamic-topological",
            ],
            researchBaseGitSha: "a".repeat(40),
            frozenAt: "2026-09-13T12:00:00.000Z",
            evidence: { path: "candidate-order.json", sha256: hash("7") },
        },
        build: {
            command: "bun run build",
            cleanWorktree: true,
            packageArtifactSha256: hash("b"),
            entry: { path: "package/dist/index.js", sha256: hash("c") },
            evidence: { path: "candidate/build.json", sha256: hash("8") },
        },
        smoke: {
            status: "pass",
            checksum: "public-smoke-checksum",
            consoleErrors: [],
            publicErrors: [],
            evidence: { path: "shiftx-smoke.json", sha256: hash("d") },
        },
    })
    const plan = {
        application: {
            gitSha: "c".repeat(40),
            runtimeTree: "d".repeat(40),
            repositoryDirty: false,
        },
        build: {
            command: "bun run build:shiftx",
            flags: ["--production"],
            artifactSha256: hash("e"),
            batchingFix: true,
        },
        cpuThrottle: 4,
        browser: {
            version: "Chrome 140",
            binarySha256: hash("f"),
            flags: ["--headless"],
        },
        scenarios: manifest.shiftxWorkloads.map(row => ({
            id: row.id,
            checksum: `${row.id}-checksum`,
        })),
    }
    const profiles = result =>
        result.rows.flatMap(row =>
            Array.from({ length: row.pairs }, (_, pair) =>
                ["control", "candidate"].map((arm, armIndex) => ({
                    id: row.id,
                    pairId: String(pair),
                    arm,
                    process: `process/${row.id}-${pair}-${arm}.json`,
                    processSha256: hash(armIndex ? "1" : "2"),
                    trace: `profile/${row.id}-${pair}-${arm}.json`,
                    traceSha256: hash(armIndex ? "3" : "4"),
                    profileTimelineSha256: hash(armIndex ? "5" : "6"),
                })),
            ).flat(),
        )
    const shiftxEvidenceRoot = mutation => {
        const root = mkdtempSync(join(tmpdir(), "shiftx-research-errors-"))
        writeFileSync(join(root, "interaction.js"), "// frozen interaction\n")
        const errorPlan = {
            ...plan,
            fixtures: [],
            interactionScript: {
                path: "interaction.js",
                sha256: fileHash(join(root, "interaction.js")),
            },
            parserSha256: fileHash(
                join(ROOT, "scripts/selector-kernel-tournament/shiftx.mjs"),
            ),
            scenarios: manifest.shiftxWorkloads.map(row => ({
                id: row.id,
                startMarker: "start",
                stepMarker: "step",
                expectedSteps: row.id === "X-SINGLE-DECISION-DROP" ? 1 : 15,
                checksum: `${row.id}-checksum`,
            })),
            commands: {
                control: ["node", "control.mjs"],
                candidate: ["node", "candidate.mjs"],
                pre28: ["node", "pre28.mjs"],
            },
        }
        writeFileSync(join(root, "plan.json"), JSON.stringify(errorPlan))
        const planSha256 = fileHash(join(root, "plan.json"))
        writeFileSync(
            join(root, "shiftx-freeze.json"),
            JSON.stringify({
                schemaVersion: 3,
                plan: "plan.json",
                sha256: planSha256,
                frozenAt: "2026-09-13T12:00:00.000Z",
            }),
        )
        const records = []
        for (const scenario of errorPlan.scenarios) {
            for (let pair = 0; pair < 8; pair++) {
                for (const arm of manifest.stages.A.timingOrder[pair % 2]) {
                    const sequence = records.length
                    const duration =
                        arm === "candidate"
                            ? 18 + ((pair + 1) % 3)
                            : 20 + (pair % 3)
                    const trace = {
                        traceEvents: [
                            {
                                name: "Profile",
                                id: "profile",
                                pid: 7,
                                tid: 8,
                                args: { data: { startTime: 100 } },
                            },
                            {
                                name: "ProfileChunk",
                                id: "profile",
                                pid: 7,
                                tid: 8,
                                args: {
                                    data: {
                                        cpuProfile: {
                                            nodes: [{ id: 1 }],
                                            samples: [1],
                                        },
                                        timeDeltas: [1],
                                    },
                                },
                            },
                            { name: "start", ts: 100, pid: 7, tid: 8 },
                            ...Array.from(
                                { length: scenario.expectedSteps },
                                (_, index) => ({
                                    name: "step",
                                    ts: 101 + index,
                                    pid: 7,
                                    tid: 8,
                                }),
                            ),
                            {
                                name: "RunTask",
                                ts: 100,
                                dur: duration,
                                pid: 7,
                                tid: 8,
                            },
                        ],
                    }
                    const tracePath = `trace-${sequence}.json`
                    writeFileSync(join(root, tracePath), JSON.stringify(trace))
                    const traceSha256 = fileHash(join(root, tracePath))
                    const sample = {
                        pid: 77 + sequence,
                        browser: errorPlan.browser.version,
                        applicationGitSha: errorPlan.application.gitSha,
                        buildArtifactSha256: errorPlan.build.artifactSha256,
                        cpuThrottle: errorPlan.cpuThrottle,
                        checksum: scenario.checksum,
                        consoleErrors: [],
                        publicErrors: [],
                        entrySha256: hash(arm === "candidate" ? "c" : "a"),
                        traceSha256,
                    }
                    if (sequence === 0 && mutation === "checksum")
                        sample.checksum = "wrong"
                    if (sequence === 0 && mutation === "console")
                        sample.consoleErrors = ["unexpected"]
                    const startedAt = new Date(
                            Date.parse("2026-09-13T12:00:01.000Z") +
                                sequence * 2000,
                        ).toISOString(),
                        endedAt = new Date(
                            Date.parse(startedAt) + 1000,
                        ).toISOString(),
                        processPath = `process-${sequence}.json`,
                        process = {
                            argv: [
                                ...errorPlan.commands[arm],
                                scenario.id,
                                String(pair),
                            ],
                            cwd: root,
                            environment: {
                                NODE_ENV: "production",
                                FORCE_COLOR: "0",
                            },
                            pid: sample.pid,
                            startedAt,
                            endedAt,
                            status: 0,
                            signal: null,
                            error: null,
                            stdout: JSON.stringify(sample),
                            stderr: "",
                        }
                    writeFileSync(
                        join(root, processPath),
                        JSON.stringify(process),
                    )
                    records.push({
                        id: scenario.id,
                        baselineId: "beta36-control",
                        pairId: String(pair),
                        arm,
                        process: processPath,
                        processSha256: fileHash(join(root, processPath)),
                        trace: tracePath,
                        traceSha256,
                        planSha256,
                        durationNs: duration * 1000,
                        profileTimelineSha256: sha256(
                            JSON.stringify(profileTimeline(trace)),
                        ),
                    })
                }
            }
        }
        if (mutation === "process") {
            records[1].process = records[0].process
            records[1].processSha256 = records[0].processSha256
        }
        writeFileSync(
            join(root, "shiftx-timings.ndjson"),
            records.map(row => JSON.stringify(row)).join("\n") + "\n",
        )
        return root
    }
    const controlBuild = {
        evidence: { path: "control/build.json", sha256: hash("9") },
        metadata: {
            gitSha: manifest.control.gitSha,
            runtimeTree: "1".repeat(40),
            tarballSha256: hash("2"),
            productionEntrySha256: hash("3"),
            distTreeSha256: hash("4"),
        },
    }
    const researchReport = (ratio = 1, pairs = 8, performance = "fail") => {
        const result = decideShiftx(lanes(ratio, pairs), "beta36-control")
        const value = {
            schemaVersion: 1,
            kind: "shiftx-research",
            promotional: false,
            runId: "shiftx-research-test",
            admission: admission(performance),
            candidate: { id: "reactive-currentness" },
            baselineBuild: {
                evidence: controlBuild.evidence,
                identity: controlBuild.metadata,
            },
            applicationBuild: {
                gitSha: plan.application.gitSha,
                runtimeTree: plan.application.runtimeTree,
                repositoryDirty: plan.application.repositoryDirty,
                command: plan.build.command,
                flags: plan.build.flags,
                artifactSha256: plan.build.artifactSha256,
                batchingFix: plan.build.batchingFix,
                cpuThrottle: plan.cpuThrottle,
            },
            browser: plan.browser,
            correctness: {
                status: "pass",
                smoke: admission().smoke,
                scenarios: plan.scenarios,
                evidence: "shiftx-timings.ndjson",
            },
            shiftx: {
                status: result.status,
                rows: JSON.parse(JSON.stringify(result.rows)),
                history: JSON.parse(JSON.stringify(result.history)),
                profiles: profiles(result),
                rawEvidence: "shiftx-timings.ndjson",
            },
        }
        return validateShiftxResearchReport(value)
    }
    test("Chrome profile timestamps retain signed timeDeltas from Profile.startTime across chunks", () => {
        const trace = {
            traceEvents: [
                {
                    name: "Profile",
                    id: "p",
                    pid: 1,
                    tid: 2,
                    args: { data: { startTime: 1000 } },
                },
                {
                    name: "ProfileChunk",
                    id: "p",
                    pid: 1,
                    tid: 2,
                    args: {
                        data: {
                            cpuProfile: { nodes: [{ id: 1 }], samples: [1, 1] },
                            timeDeltas: [10, -4],
                        },
                    },
                },
                {
                    name: "ProfileChunk",
                    id: "p",
                    pid: 1,
                    tid: 2,
                    args: {
                        data: { cpuProfile: { samples: [1] }, timeDeltas: [9] },
                    },
                },
            ],
        }
        expect(profileTimeline(trace)[0].samples).toEqual([
            { node: 1, delta: 10, at: 1010 },
            { node: 1, delta: -4, at: 1006 },
            { node: 1, delta: 9, at: 1015 },
        ])
        trace.traceEvents[1].args.data.timeDeltas.pop()
        expect(() => profileTimeline(trace)).toThrow("SHIFTX-PROFILE")
    })
    test("interaction timing ends at the containing RunTask and preserves the fixed gesture count", () => {
        const trace = {
            traceEvents: [
                { name: "up", ts: 100, pid: 1, tid: 2 },
                { name: "RunTask", ts: 90, dur: 40, pid: 1, tid: 2 },
            ],
        }
        expect(
            interactionDuration(trace, {
                startMarker: "up",
                stepMarker: "up",
                expectedSteps: 1,
            }),
        ).toBe(30000)
        expect(() =>
            interactionDuration(trace, {
                startMarker: "up",
                stepMarker: "up",
                expectedSteps: 15,
            }),
        ).toThrow("SHIFTX-INTERACTION")
    })
    test("ShiftX keeps the existing paired estimator, protected direction, and bounded extension rule", () => {
        expect(decideShiftx(lanes(), "beta36-control").status).toBe("pass")
        expect(decideShiftx(lanes(1.2), "beta36-control").status).toBe("fail")
        expect(() => decideShiftx(lanes(1, 12), "beta36-control")).toThrow(
            "SHIFTX-SELECTIVE-EXTENSION",
        )
        expect(() => decideShiftx(lanes(1, 9), "beta36-control")).toThrow(
            "SHIFTX-PAIRS",
        )
        expect(decideShiftx(lanes(1.1, 12), "beta36-control").status).toBe(
            "inconclusive",
        )
        expect(
            decideShiftx(lanes(0.95), "pre28-claim").rows.every(
                r =>
                    r.decisions.pre28Claim?.status === "pass" &&
                    r.decisions.protectedNonRegression === null &&
                    r.decisions.intendedWin === null,
            ),
        ).toBe(true)
        expect(decideShiftx(lanes(1), "pre28-claim").status).toBe(
            "inconclusive",
        )
    })

    test("fifteen-step timing uses the chronologically final step and excludes pre-start markers", () => {
        const scenario = {
            startMarker: "start",
            stepMarker: "step",
            expectedSteps: 15,
        }
        const steps = Array.from({ length: 15 }, (_, i) => ({
            name: "step",
            ts: 110 + i * 5,
            pid: 1,
            tid: 2,
        }))
        const trace = {
            traceEvents: [
                { name: "start", ts: 100, pid: 1, tid: 2 },
                { name: "RunTask", ts: 100, dur: 130, pid: 1, tid: 2 },
                ...steps.toReversed(),
            ],
        }
        expect(interactionDuration(trace, scenario)).toBe(130000)
        trace.traceEvents[2].ts = 99
        expect(() => interactionDuration(trace, scenario)).toThrow(
            "SHIFTX-INTERACTION",
        )
    })
    test("a split process state cannot establish the diagnostic pre28 claim", () => {
        const rows = lanes(0.5)
        for (const row of rows)
            row.samples.forEach(
                (s, i) => (s.headNs = s.baseNs * (i % 2 ? 0.7 : 0.5)),
            )
        const result = decideShiftx(rows, "pre28-claim")
        expect(result.status).toBe("inconclusive")
        expect(
            result.rows.every(
                r =>
                    r.flags.includes("bimodal") &&
                    r.decisions.pre28Claim.status === "inconclusive",
            ),
        ).toBe(true)
    })
    test.each(["fail", "inconclusive"])(
        "research admission ignores old Contract C performance %s while retaining diagnostics",
        performanceStatus => {
            const value = admission(performanceStatus)
            expect(validateShiftxResearchAdmission(value)).toBe(value)
            expect(value.contractC.diagnostics).toEqual({
                performance: {
                    status: performanceStatus,
                    rows: [{ ratio: 1.1 }],
                },
                p95: { status: "not-run", rows: [{ ratio: 1.1 }] },
                memory: { status: "inconclusive", rows: [{ bytes: 1234 }] },
                size: { status: "fail", rows: [{ gzipBytes: 5678 }] },
            })
        },
    )
    test.each(Object.entries(PRESERVED_RESEARCH_CANDIDATES))(
        "admits preserved candidate %s at its exact Contract C source identity",
        (candidateId, identity) => {
            const value = admission()
            const { gitSha, diffSha256, contractCGitSha, contractCSha256sums } =
                identity
            value.candidateId = candidateId
            value.source = { gitSha, diffSha256 }
            value.replay.diffSha256 = diffSha256
            value.contractC.bundle.sha256sums = contractCSha256sums
            value.contractC.candidateIdentity = {
                id: candidateId,
                gitSha: contractCGitSha,
                diffSha256,
            }
            expect(validateShiftxResearchAdmission(value)).toBe(value)
        },
    )
    test("Contract C admission rejects a caller-authored pass summary whose bundle seal is not preserved", async () => {
        const root = mkdtempSync(join(tmpdir(), "shiftx-research-contract-c-"))
        try {
            const value = admission()
            const forgedReport = {
                candidate: {
                    id: value.candidateId,
                    stage: "C",
                    frozenDiffSha256: value.source.diffSha256,
                },
                provenance: {
                    status: "pass",
                    candidateIdentity: { gitSha: value.source.gitSha },
                },
                gates: {
                    provenance: { status: "pass" },
                    contractC: { status: "pass" },
                },
                semanticCases: value.contractC.publicSemantics,
            }
            expect(() => schemaCheck(forgedReport)).toThrow("INPUT-SCHEMA")
            writeFileSync(
                join(root, "report.json"),
                JSON.stringify(forgedReport),
            )
            value.contractC.bundle = {
                path: root,
                sha256sums: sealEvidence(root),
            }
            await expect(validateRecordedContractC(value)).rejects.toThrow(
                "SHIFTX-RESEARCH-CONTRACT-C",
            )
        } finally {
            rmSync(root, { recursive: true, force: true })
        }
    })
    test("research admission requires passing C provenance and public semantics plus unchanged exact identities", () => {
        const mutations = [
            value => (value.candidateId = "unknown-candidate"),
            value => (value.contractC.provenanceStatus = "fail"),
            value => (value.contractC.bundle.sha256sums = hash("0")),
            value => (value.contractC.publicSemantics[0].status = "fail"),
            value =>
                (value.contractC.candidateIdentity.gitSha = "0".repeat(40)),
            value => (value.source.gitSha = "0".repeat(40)),
            value => (value.source.diffSha256 = hash("0")),
            value => (value.replay.diffSha256 = "not-a-hash"),
            value => (value.replay.gitSha = value.replay.baseGitSha),
            value => (value.execution.researchBaseGitSha = "0".repeat(40)),
            value => value.execution.candidateOrder.pop(),
            value => (value.build.cleanWorktree = false),
            value => value.smoke.consoleErrors.push("unexpected"),
        ]
        for (const mutate of mutations) {
            const value = admission()
            mutate(value)
            expect(() => validateShiftxResearchAdmission(value)).toThrow(
                "SHIFTX-RESEARCH-",
            )
        }
    })
    test("candidate execution order may vary but its complete membership is frozen", () => {
        const value = admission()
        value.execution.candidateOrder.reverse()
        expect(validateShiftxResearchAdmission(value)).toBe(value)
    })
    test.each([
        ["pass", 1, 8],
        ["fail", 1.2, 8],
        ["inconclusive", 1.1, 12],
    ])(
        "preserves completed ShiftX %s rows, statistics, profiles, correctness, and identities",
        (outcome, ratio, pairs) => {
            const report = researchReport(ratio, pairs)
            expect(report.shiftx.status).toBe(outcome)
            expect(report.shiftx.rows).toHaveLength(2)
            expect(
                report.shiftx.rows.every(row => row.interval90.length === 2),
            ).toBe(true)
            expect(report.shiftx.rows.every(row => row.p95Ratio > 0)).toBe(true)
            expect(report.shiftx.profiles).toHaveLength(2 * pairs * 2)
            expect(report.correctness.status).toBe("pass")
            expect(report.admission.source.gitSha).toBe(
                PRESERVED_RESEARCH_CANDIDATES["reactive-currentness"].gitSha,
            )
            expect(report.admission.replay).toEqual(admission().replay)
            expect(report.admission.build.entry.path).toBe(
                "package/dist/index.js",
            )
            expect(report.applicationBuild.artifactSha256).toBe(hash("e"))
            expect(report.admission.contractC.diagnostics.size.rows).toEqual([
                { gzipBytes: 5678 },
            ])
        },
    )
    test("research report shape is explicit, closed, and contains no promotion decision", () => {
        const report = researchReport()
        expect(report.kind).toBe("shiftx-research")
        expect(report.promotional).toBe(false)
        expect("stage" in report.candidate).toBe(false)
        expect("selection" in report).toBe(false)
        expect(() =>
            validateShiftxResearchReport(JSON.parse(JSON.stringify(report))),
        ).not.toThrow()
        const maximumRunId = structuredClone(report)
        maximumRunId.runId = "x".repeat(256)
        expect(() => validateShiftxResearchReport(maximumRunId)).not.toThrow()
        for (const mutate of [
            value => (value.kind = "candidate"),
            value => (value.promotional = true),
            value => (value.candidate.stage = "shiftx"),
            value => (value.selection = { machineEligible: true }),
            value =>
                (value.admission.contractC.diagnostics.performance.rows[0].machineEligible =
                    true),
            value => (value.runId = 123),
            value => (value.runId = "x".repeat(257)),
            value => (value.shiftx.rows[0].decisions.extra = true),
            value => (value.shiftx.history[0].decisions = [null, null]),
            value => {
                value.shiftx.rows.forEach(row => (row.status = "fail"))
                value.shiftx.status = "fail"
            },
            value => (value.shiftx.history.at(-1).tailPass = false),
            value => (value.shiftx.rows[0].interval90 = []),
            value => value.shiftx.profiles.pop(),
        ]) {
            const changed = structuredClone(report)
            mutate(changed)
            expect(() => validateShiftxResearchReport(changed)).toThrow(
                "SHIFTX-RESEARCH-",
            )
        }
    })
    test("existing ShiftX validator accepts the complete synthetic evidence control", async () => {
        const root = shiftxEvidenceRoot()
        try {
            const result = await validateShiftx(root, {
                candidateSha: "b".repeat(40),
                controlIdentity: { productionEntrySha256: hash("a") },
                candidateIdentity: { productionEntrySha256: hash("c") },
            })
            expect(result.status).toBe("pass")
            expect(result.results["beta36-control"]).toMatchObject({
                status: "pass",
                rows: expect.any(Array),
                history: expect.any(Array),
            })
            expect(
                Object.keys(artifactIdentity(controlBuild.metadata)),
            ).toEqual([
                "gitSha",
                "runtimeTree",
                "tarballSha256",
                "productionEntrySha256",
                "distTreeSha256",
            ])
        } finally {
            rmSync(root, { recursive: true, force: true })
        }
    })
    test.each([
        ["checksum", "SHIFTX-SEMANTICS"],
        ["console", "SHIFTX-SEMANTICS"],
        ["process", "SHIFTX-PROCESS: process reused"],
        ["identity", "SHIFTX-ENTRY-HASH"],
    ])(
        "existing ShiftX validation rejects a wrong %s record",
        async (mutation, failure) => {
            const root = shiftxEvidenceRoot(mutation)
            try {
                await expect(
                    validateShiftx(root, {
                        candidateSha: "b".repeat(40),
                        controlIdentity: {
                            productionEntrySha256: hash("a"),
                        },
                        candidateIdentity: {
                            productionEntrySha256: hash(
                                mutation === "identity" ? "d" : "c",
                            ),
                        },
                    }),
                ).rejects.toThrow(failure)
            } finally {
                rmSync(root, { recursive: true, force: true })
            }
        },
    )
    test("replay identity binds the authorized common base, exact commit, diff, and clean worktree", () => {
        const root = mkdtempSync(join(tmpdir(), "shiftx-research-replay-"))
        const git = (...args) =>
            execFileSync("git", args, {
                cwd: root,
                encoding: "utf8",
                env: {
                    ...process.env,
                    GIT_CONFIG_GLOBAL: "/dev/null",
                    GIT_CONFIG_NOSYSTEM: "1",
                },
            }).trim()
        try {
            git("init", "-q")
            git("config", "commit.gpgsign", "false")
            git("config", "core.hooksPath", "/dev/null")
            git("config", "user.email", "research@example.invalid")
            git("config", "user.name", "Research Test")
            writeFileSync(join(root, "candidate.txt"), "base\n")
            git("add", "candidate.txt")
            git("commit", "-qm", "base")
            const baseGitSha = git("rev-parse", "HEAD")
            writeFileSync(join(root, "candidate.txt"), "replay\n")
            git("commit", "-qam", "replay")
            const replayGitSha = git("rev-parse", "HEAD")
            const replayDiffSha256 = Bun.CryptoHasher.hash(
                "sha256",
                execFileSync(
                    "git",
                    [
                        "diff",
                        "--binary",
                        "--no-ext-diff",
                        baseGitSha,
                        replayGitSha,
                    ],
                    { cwd: root, maxBuffer: 64 * 1024 * 1024 },
                ),
                "hex",
            )
            const value = admission()
            value.replay = {
                baseGitSha,
                gitSha: replayGitSha,
                diffSha256: replayDiffSha256,
                review: value.replay.review,
            }
            value.execution.researchBaseGitSha = baseGitSha
            expect(validateReplayIdentity(root, value, baseGitSha)).toEqual(
                value.replay,
            )
            expect(() =>
                validateReplayIdentity(root, value, "0".repeat(40)),
            ).toThrow("SHIFTX-RESEARCH-REPLAY")
            const recordedDiffSha256 = value.replay.diffSha256
            value.replay.diffSha256 = hash("0")
            expect(() =>
                validateReplayIdentity(root, value, baseGitSha),
            ).toThrow("SHIFTX-RESEARCH-REPLAY")
            value.replay.diffSha256 = recordedDiffSha256
            expect(() =>
                validateReplayIdentity(
                    join(root, "missing-repository"),
                    value,
                    baseGitSha,
                ),
            ).toThrow("SHIFTX-RESEARCH-REPLAY")
            writeFileSync(join(root, "candidate.txt"), "dirty\n")
            expect(() =>
                validateReplayIdentity(root, value, baseGitSha),
            ).toThrow("SHIFTX-RESEARCH-REPLAY")
        } finally {
            rmSync(root, { recursive: true, force: true })
        }
    }, 10_000)
    test("replay admission binds an authenticated trusted review to both recorded identities", () => {
        const root = mkdtempSync(join(tmpdir(), "shiftx-research-review-"))
        try {
            const value = admission()
            const review = {
                schemaVersion: 1,
                candidateId: value.candidateId,
                source: value.source,
                replay: Object.fromEntries(
                    Object.entries(value.replay).filter(
                        ([key]) => key !== "review",
                    ),
                ),
                status: "pass",
                reviewer: "first-party-reviewer",
                reviewedAt: "2026-09-13T12:00:00.000Z",
            }
            const path = join(root, "replay-review.json")
            writeFileSync(path, JSON.stringify(review))
            value.replay.review = {
                path: "replay-review.json",
                sha256: fileHash(path),
            }
            expect(validateReplayReview(root, value)).toEqual(review)
            value.replay.review.sha256 = hash("0")
            expect(() => validateReplayReview(root, value)).toThrow(
                "SHIFTX-RESEARCH-REPLAY-REVIEW",
            )
            for (const mutate of [
                changed => (changed.status = "fail"),
                changed => (changed.reviewer = ""),
                changed => (changed.reviewedAt = "not-a-date"),
                changed => (changed.replay.diffSha256 = hash("0")),
            ]) {
                const changed = structuredClone(review)
                mutate(changed)
                writeFileSync(path, JSON.stringify(changed))
                value.replay.review.sha256 = fileHash(path)
                expect(() => validateReplayReview(root, value)).toThrow(
                    "SHIFTX-RESEARCH-REPLAY-REVIEW",
                )
            }
        } finally {
            rmSync(root, { recursive: true, force: true })
        }
    })
    test("research runner requires an independently supplied common replay base", async () => {
        await expect(
            runShiftxResearch("/unused", {
                runId: "missing-common-base",
                admission: admission(),
                candidateRoot: "/unused",
                controlBuild: { path: "control/build.json", sha256: hash() },
            }),
        ).rejects.toThrow("SHIFTX-RESEARCH-REPLAY")
    })
    test("candidate schema, canonical recomputation, and prior-stage validation all reject research evidence", async () => {
        const report = researchReport()
        expect(() => schemaCheck(report)).toThrow("INPUT-SCHEMA")

        const recomputeRoot = mkdtempSync(
            join(tmpdir(), "shiftx-research-recompute-"),
        )
        const priorRoot = mkdtempSync(join(tmpdir(), "shiftx-research-prior-"))
        const bundleRoot = mkdtempSync(
            join(tmpdir(), "shiftx-research-bundle-"),
        )
        try {
            writeFileSync(
                join(recomputeRoot, "provenance.json"),
                JSON.stringify({ candidateRoot: ROOT }),
            )
            writeFileSync(
                join(recomputeRoot, "run.json"),
                JSON.stringify(report),
            )
            await expect(recomputeReport(recomputeRoot)).rejects.toThrow(
                "REPORT-RUN-SCHEMA",
            )

            writeFileSync(
                join(bundleRoot, "report.json"),
                JSON.stringify(report),
            )
            const sums = sealEvidence(bundleRoot)
            writeFileSync(
                join(priorRoot, "prior-stage.json"),
                JSON.stringify({ path: bundleRoot, sha256sums: sums }),
            )
            await expect(
                validatePriorStage(priorRoot, {
                    kind: "candidate",
                    stage: "A",
                    id: report.candidate.id,
                    revision: 1,
                    gitSha: report.admission.replay.gitSha,
                }),
            ).rejects.toThrow("STAGE-PREREQUISITE")
        } finally {
            rmSync(recomputeRoot, { recursive: true, force: true })
            rmSync(priorRoot, { recursive: true, force: true })
            rmSync(bundleRoot, { recursive: true, force: true })
        }
    })
}
