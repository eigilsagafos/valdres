import {
    existsSync,
    readFileSync,
    writeFileSync,
    mkdirSync,
    openSync,
    closeSync,
    unlinkSync,
} from "node:fs"
import { join, dirname } from "node:path"
import {
    ROOT,
    manifest,
    json,
    fileHash,
    sha256,
    requireGate,
    exactRows,
} from "./inputs.mjs"
import { inspectArtifact, installArtifact } from "./artifact.mjs"
import {
    prepareWorkloads,
    runWorkloadProcess,
    EXPECTATIONS,
} from "./workloads.mjs"
import { validateWorkloadSample } from "./workload-validation.mjs"
import {
    environmentObservation,
    requireStableEnvironment,
    verifyFrozenPlan,
    verifyProvenanceCurrent,
} from "./provenance.mjs"
import { writeEvidence, evidencePath, strictKeys, same } from "./evidence.mjs"
import {
    tournamentPairs,
    decideTournament,
} from "../lib/paired-decision-tournament.ts"
import { validateWorkloadInvocation } from "./runner-validation.mjs"
import { absoluteCoreGate } from "./core-preflight.mjs"
import { verifyPreflightEvidence } from "./preflight.mjs"
const recordKeys = [
    "stage",
    "id",
    "runtime",
    "pairId",
    "arm",
    "implementationId",
    "process",
    "processSha256",
    "stdoutSha256",
    "stderrSha256",
    "semanticPreflight",
    "semanticPreflightSha256",
    "durationNs",
]
export function validatePreflight(value, stage, identity) {
    strictKeys(
        value,
        [
            "schemaVersion",
            "stage",
            "gitSha",
            "timedArtifactSha256",
            "counterArtifactSha256",
            "family",
            "core",
            "rows",
        ],
        "PREFLIGHT-SCHEMA",
    )
    requireGate(
        value.schemaVersion === 3 &&
            value.stage === stage &&
            value.gitSha === identity.gitSha &&
            value.timedArtifactSha256 === identity.tarballSha256 &&
            value.counterArtifactSha256 !== identity.tarballSha256,
        "PREFLIGHT-IDENTITY",
        "wrong semantic artifact",
    )
    requireGate(
        value.family.status === "pass" && value.family.scoring === false,
        "FAMILY-COMPATIBILITY",
        "frozen family gate missing",
    )
    const expected = manifest.semanticCases
        .filter(r => r.requiredAt.includes(stage))
        .flatMap(r =>
            ["bun", "node"].flatMap(runtime =>
                ["public", "counter"].map(mode => `${r.id}/${runtime}/${mode}`),
            ),
        )
    exactRows(
        value.rows.map(r => `${r.id}/${r.runtime}/${r.mode}`),
        expected,
        "PREFLIGHT-INVENTORY",
    )
    for (const row of value.rows) {
        strictKeys(
            row,
            ["id", "runtime", "mode", "status", "evidence", "traceSha256"],
            "PREFLIGHT-SCHEMA",
        )
        requireGate(
            row.status === "pass" && /^[a-f0-9]{64}$/.test(row.traceSha256),
            "PREFLIGHT-FAIL",
            row.id,
        )
    }
}
export async function withRunnerLock(evidenceRoot, body) {
    mkdirSync(evidenceRoot, { recursive: true })
    const file = join(evidenceRoot, ".runner-lock")
    requireGate(
        !existsSync(file),
        "RUNNER-BUSY",
        "another tournament run holds the runner",
    )
    const token = JSON.stringify({
        pid: process.pid,
        at: new Date().toISOString(),
    })
    const fd = openSync(file, "wx")
    writeFileSync(fd, token)
    closeSync(fd)
    try {
        return await body()
    } finally {
        requireGate(
            readFileSync(file, "utf8") === token,
            "RUNNER-LOCK",
            "runner ownership changed",
        )
        unlinkSync(file)
    }
}
export function rotateLanes(rows, seed) {
    let state = seed >>> 0
    const result = [...rows]
    for (let i = result.length - 1; i > 0; i--) {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0
        const j = state % (i + 1)
        ;[result[i], result[j]] = [result[j], result[i]]
    }
    return result
}
export function collectTimings({
    root,
    stage,
    planArtifact,
    provenance,
    controlDirectory,
    headDirectory,
    preflightControl,
    preflightHead,
    seed = 0x5eed,
}) {
    verifyProvenanceCurrent(provenance)
    const plan = verifyFrozenPlan(root, planArtifact)
    requireGate(stage === "C" || stage === "A", "TIMING-STAGE", stage)
    const output = join(root, `timing-${stage}`),
        runner = prepareWorkloads(output),
        artifacts = {
            control: json(join(controlDirectory, "artifact.json")),
            candidate: json(join(headDirectory, "artifact.json")),
        },
        directories = { control: controlDirectory, candidate: headDirectory }
    for (const arm of ["control", "candidate"]) {
        const a = artifacts[arm]
        requireGate(
            a.mode === "timed",
            "ARTIFACT-INSTRUMENTATION",
            "counter artifact cannot be timed",
        )
        inspectArtifact(join(directories[arm], a.tarball), a, "timed").cleanup()
    }
    writeEvidence(root, `timing-${stage}/runner.json`, runner)
    const preflights = { control: preflightControl, candidate: preflightHead }
    for (const arm of ["control", "candidate"])
        validatePreflight(
            json(evidencePath(root, preflights[arm])),
            stage,
            artifacts[arm],
        )
    const run = json(evidencePath(root, "run.json")),
        cache = new Map()
    requireGate(
        artifacts.candidate.gitSha === plan.gitSha &&
            artifacts.control.gitSha === manifest.control.gitSha,
        "PROVENANCE-CANDIDATE-HEAD",
        "timing artifact differs from declared revision",
    )
    for (const arm of ["control", "candidate"]) {
        const counter = json(evidencePath(root, run.artifacts[arm].counter))
        verifyPreflightEvidence(
            root,
            json(evidencePath(root, preflights[arm])),
            { timed: artifacts[arm], counter },
            cache,
        )
    }
    const consumers = {}
    for (const runtime of ["bun", "node"])
        for (const arm of ["control", "candidate"]) {
            const path = join(output, `consumer-${runtime}-${arm}`)
            installArtifact(
                join(directories[arm], artifacts[arm].tarball),
                artifacts[arm],
                path,
            )
            consumers[`${runtime}/${arm}`] = path
        }
    const lanes = rotateLanes(
        manifest.performanceWorkloads
            .filter(row => row.requiredAt.includes(stage))
            .flatMap(row => row.runtimes.map(runtime => ({ row, runtime }))),
        seed,
    )
    const records = [],
        environments = []
    writeEvidence(root, `timing-${stage}/schedule.json`, {
        stage,
        seed,
        laneOrder: lanes.map(({ row, runtime }) => `${row.id}/${runtime}`),
        implementationOrder: [plan.id],
        planSha256: planArtifact.sha256,
    })
    for (const { row, runtime } of lanes) {
        const laneRecords = [],
            laneEnvironments = []
        try {
            for (
                let pair = 0;
                pair < tournamentPairs(stage, row.group === "packed-core-load");
                pair++
            ) {
                verifyFrozenPlan(root, planArtifact)
                const before = environmentObservation()
                const pairEnvironment = {
                    pairId: String(pair),
                    before,
                    after: null,
                }
                laneEnvironments.push(pairEnvironment)
                requireStableEnvironment(before, before)
                for (const arm of manifest.stages[stage].timingOrder[
                    pair % 2
                ]) {
                    const processFile = `timing-${stage}/${row.id}-${runtime}-${pair}-${arm}.process.json`
                    const sample = runWorkloadProcess({
                        runner,
                        consumer: consumers[`${runtime}/${arm}`],
                        artifact: artifacts[arm],
                        row,
                        runtime,
                        mode: "timed",
                        output: evidencePath(root, processFile),
                    })
                    const processResult = json(evidencePath(root, processFile))
                    laneRecords.push({
                        stage,
                        id: row.id,
                        runtime,
                        pairId: String(pair),
                        arm,
                        implementationId:
                            arm === "control" ? "beta36-control" : plan.id,
                        process: processFile,
                        processSha256: fileHash(
                            evidencePath(root, processFile),
                        ),
                        stdoutSha256: sha256(processResult.stdout),
                        stderrSha256: sha256(processResult.stderr),
                        semanticPreflight: preflights[arm],
                        semanticPreflightSha256: fileHash(
                            evidencePath(root, preflights[arm]),
                        ),
                        durationNs: sample.durationNs,
                    })
                }
                const after = environmentObservation()
                pairEnvironment.after = after
                requireStableEnvironment(before, after)
            }
        } catch (error) {
            writeEvidence(
                root,
                `timing-${stage}/${row.id}-${runtime}.invalid.json`,
                {
                    kind: "invalid-whole-lane",
                    reason: error.message,
                    records: laneRecords,
                    environments: laneEnvironments,
                },
            )
            throw error
        }
        records.push(...laneRecords)
        environments.push({ id: row.id, runtime, pairs: laneEnvironments })
        writeEvidence(
            root,
            `timing-${stage}/${row.id}-${runtime}.ndjson`,
            laneRecords.map(r => JSON.stringify(r) + "\n").join(""),
        )
    }
    verifyProvenanceCurrent(provenance)
    writeEvidence(root, `timing-${stage}/environments.json`, environments)
    writeEvidence(
        root,
        `timing-${stage}/timings.ndjson`,
        records.map(r => JSON.stringify(r) + "\n").join(""),
    )
    return records
}
export function validateTimings(root, records, { stage, plan, artifacts }) {
    const expectations = json(EXPECTATIONS)
    const environment = json(
        evidencePath(root, `timing-${stage}/environments.json`),
    )
    const schedule = json(evidencePath(root, `timing-${stage}/schedule.json`))
    strictKeys(
        schedule,
        ["stage", "seed", "laneOrder", "implementationOrder", "planSha256"],
        "TIMING-SCHEDULE",
    )
    requireGate(
        schedule.stage === stage && Number.isSafeInteger(schedule.seed),
        "TIMING-SCHEDULE",
        "invalid stage or seed",
    )
    same(
        schedule.implementationOrder,
        [plan.id],
        "TIMING-SCHEDULE",
        "implementation order",
    )
    const planned = rotateLanes(
        manifest.performanceWorkloads
            .filter(row => row.requiredAt.includes(stage))
            .flatMap(row => row.runtimes.map(runtime => ({ row, runtime }))),
        schedule.seed,
    ).map(({ row, runtime }) => row.id + "/" + runtime)
    same(
        schedule.laneOrder,
        planned,
        "TIMING-SCHEDULE",
        "rotation differs from recorded seed",
    )
    const expectedRows = manifest.performanceWorkloads
        .filter(row => row.requiredAt.includes(stage))
        .flatMap(row => row.runtimes.map(runtime => `${row.id}/${runtime}`))
    const byLane = new Map()
    const processFiles = new Set()
    let lastEnd = ""
    for (const record of records) {
        strictKeys(record, recordKeys, "TIMING-SCHEMA")
        requireGate(
            record.stage === stage &&
                ["control", "candidate"].includes(record.arm),
            "TIMING-STAGE",
            "unknown stage or arm",
        )
        const key = record.id + "/" + record.runtime
        requireGate(expectedRows.includes(key), "TIMING-ID", key)
        requireGate(
            record.implementationId ===
                (record.arm === "control" ? "beta36-control" : plan.id),
            "TIMING-IDENTITY",
            "unknown implementation",
        )
        requireGate(
            !processFiles.has(record.process),
            "TIMING-PROCESS",
            "one process cannot supply multiple observations",
        )
        processFiles.add(record.process)
        requireGate(
            fileHash(evidencePath(root, record.process)) ===
                record.processSha256,
            "PROVENANCE-PROCESS-HASH",
            record.process,
        )
        const process = json(evidencePath(root, record.process))
        strictKeys(
            process,
            [
                "argv",
                "cwd",
                "environment",
                "pid",
                "startedAt",
                "endedAt",
                "status",
                "signal",
                "error",
                "stdout",
                "stderr",
            ],
            "PROVENANCE-PROCESS-SCHEMA",
        )
        requireGate(
            process.status === 0 &&
                process.error === null &&
                process.signal === null,
            "TIMING-FAILED-PROCESS",
            record.process,
        )
        requireGate(
            sha256(process.stdout) === record.stdoutSha256 &&
                sha256(process.stderr) === record.stderrSha256,
            "PROVENANCE-STDIO-HASH",
            record.process,
        )
        requireGate(
            Number.isInteger(process.pid) &&
                process.pid > 0 &&
                Number.isFinite(Date.parse(process.startedAt)) &&
                Date.parse(process.endedAt) >= Date.parse(process.startedAt),
            "PROVENANCE-PROCESS-SCHEMA",
            "PID or timestamps",
        )
        requireGate(
            !lastEnd || Date.parse(process.startedAt) >= Date.parse(lastEnd),
            "TIMING-ORDER",
            "process observations overlap or reorder",
        )
        lastEnd = process.endedAt
        validateWorkloadInvocation(root, process, {
            stage,
            id: record.id,
            runtime: record.runtime,
            arm: record.arm,
            artifact: artifacts[record.arm],
        })
        requireGate(
            process.environment.NODE_ENV === "production" &&
                !process.environment.NODE_OPTIONS &&
                !process.environment.BUN_OPTIONS &&
                !process.environment.NODE_PATH,
            "PROVENANCE-ENVIRONMENT",
            "runtime conditions changed",
        )
        requireGate(
            process.argv[0] === record.runtime &&
                process.argv.includes(record.id) &&
                process.argv.includes("timed") &&
                !process.argv.includes("--expose-gc"),
            "PROVENANCE-INVOCATION",
            "timing invocation drift",
        )
        const sample = JSON.parse(process.stdout),
            row = manifest.performanceWorkloads.find(r => r.id === record.id)
        requireGate(
            sample.pid === process.pid,
            "PROVENANCE-PID",
            "worker PID mismatch",
        )
        validateWorkloadSample(sample, {
            row,
            runtime: record.runtime,
            mode: "timed",
            expected: expectations.rows.find(e => e.id === row.id),
            entrySha256: artifacts[record.arm].productionEntrySha256,
        })
        assertTimingDuration(record, sample)
        requireGate(
            fileHash(evidencePath(root, record.semanticPreflight)) ===
                record.semanticPreflightSha256,
            "PREFLIGHT-HASH",
            "preflight changed",
        )
        validatePreflight(
            json(evidencePath(root, record.semanticPreflight)),
            stage,
            artifacts[record.arm],
        )
        if (!byLane.has(key)) byLane.set(key, [])
        byLane.get(key).push(record)
    }
    exactRows([...byLane.keys()], expectedRows, "TIMING-INVENTORY")
    same([...byLane.keys()], planned, "TIMING-SCHEDULE", "lane order differs")
    same(
        environment.map(e => e.id + "/" + e.runtime),
        planned,
        "PROVENANCE-ENVIRONMENT",
        "missing lane observations",
    )
    for (const lane of environment) {
        strictKeys(lane, ["id", "runtime", "pairs"], "PROVENANCE-ENVIRONMENT")
        const observations = byLane.get(lane.id + "/" + lane.runtime)
        requireGate(
            lane.pairs.length * 2 === observations.length,
            "PROVENANCE-ENVIRONMENT",
            "missing pair observation",
        )
        for (const [index, pair] of lane.pairs.entries()) {
            strictKeys(
                pair,
                ["pairId", "before", "after"],
                "PROVENANCE-ENVIRONMENT",
            )
            requireGate(
                pair.pairId === String(index),
                "PROVENANCE-ENVIRONMENT",
                "pair ordinal",
            )
            requireStableEnvironment(pair.before, pair.after)
            const first = json(
                    evidencePath(root, observations[index * 2].process),
                ),
                last = json(
                    evidencePath(root, observations[index * 2 + 1].process),
                )
            requireGate(
                Date.parse(pair.before.at) <= Date.parse(first.startedAt) &&
                    Date.parse(pair.after.at) >= Date.parse(last.endedAt),
                "PROVENANCE-ENVIRONMENT",
                "environment observations do not bracket pair",
            )
        }
    }
    const lanes = []
    for (const [key, observations] of byLane) {
        const [id, runtime] = key.split("/"),
            row = manifest.performanceWorkloads.find(r => r.id === id),
            pairs = tournamentPairs(stage, row.group === "packed-core-load")
        requireGate(observations.length === pairs * 2, "TIMING-PAIRS", key)
        const samples = []
        for (let pair = 0; pair < pairs; pair++) {
            const pairRows = observations.slice(pair * 2, pair * 2 + 2)
            same(
                pairRows.map(r => r.arm),
                manifest.stages[stage].timingOrder[pair % 2],
                "TIMING-ORDER",
                key,
            )
            requireGate(
                pairRows.every(r => r.pairId === String(pair)),
                "TIMING-PAIRS",
                "missing, repeated, or reordered pair",
            )
            samples.push({
                pairId: String(pair),
                baseNs: pairRows.find(r => r.arm === "control").durationNs,
                headNs: pairRows.find(r => r.arm === "candidate").durationNs,
            })
        }
        lanes.push({
            id,
            runtime,
            core: row.group === "packed-core-load",
            intended: plan.intendedWorkloads.includes(id),
            samples,
        })
    }
    const result = decideTournament(lanes, stage, {
        control: plan.kind === "control",
    })
    const coreAbsolute = stage === "A" ? absoluteCoreGate(result.rows) : []
    result.coreAbsolute = coreAbsolute
    if (
        plan.kind === "candidate" &&
        coreAbsolute.some(row => row.status === "fail")
    )
        result.performanceStatus = "fail"
    return result
}

export function assertTimingDuration(record, sample) {
    requireGate(
        record.durationNs === sample.durationNs,
        "PROVENANCE-RESULT-ROW",
        "duration differs from process output",
    )
}
