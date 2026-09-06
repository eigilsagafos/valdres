import { assertInstalledArtifact } from "./artifact.mjs"
import { join, dirname } from "node:path"
import { existsSync, mkdirSync } from "node:fs"
import {
    ROOT,
    frozenInputBytes,
    frozenInputJson,
    sha256,
    manifest,
    json,
    fileHash,
    requireGate,
    assertClean,
    checkInputs,
} from "./inputs.mjs"
import {
    captureCommand,
    command,
    installArtifact,
    inspectArtifact,
} from "./artifact.mjs"
import { writeEvidence, evidencePath } from "./evidence.mjs"
import { buildLegacyWrappers } from "./legacy-wrappers.mjs"
import {
    environmentObservation,
    requireStableEnvironment,
    verifyProvenanceCurrent,
} from "./provenance.mjs"
import {
    memoryProcessSummary,
    decideMemory,
    decideSizes,
} from "./resource-validation.mjs"
import {
    normalizeSizes,
    validateMemoryEvidence,
    validateSizeEvidence,
    validateSizeProcess,
} from "./resource-evidence.mjs"
import { validateProcess } from "./process-evidence.mjs"
import { packedRootReachability } from "./reachability.mjs"
export function prepareMemory(root, { controlDirectory, headDirectory }) {
    assertClean()
    checkInputs()
    const directory = join(root, "memory")
    requireGate(!existsSync(directory), "EVIDENCE-IMMUTABLE", directory)
    mkdirSync(directory, { recursive: true })
    const worker = join(directory, "worker.mjs"),
        wrapper = join(directory, "factories.mjs")
    writeEvidence(
        root,
        "memory/build.process.json",
        captureCommand(
            [
                "bun",
                "build",
                join(
                    ROOT,
                    "scripts/selector-kernel-tournament/memory-worker.mjs",
                ),
                "--target=node",
                `--outfile=${worker}`,
            ],
            ROOT,
        ),
    )
    requireGate(existsSync(worker), "MEMORY-WORKER", "build failed")
    validateProcess(json(join(root, "memory/build.process.json")))
    const generated = buildLegacyWrappers(wrapper),
        runner = {
            workerSha256: fileHash(worker),
            wrapperSha256: generated.generatedSha256,
            sourceSha256: sha256(
                frozenInputBytes(manifest.memoryScenarios[0].sourceTest),
            ),
        }
    writeEvidence(root, "memory/runner.json", runner)
    const artifacts = {},
        directories = { control: controlDirectory, candidate: headDirectory }
    for (const arm of ["control", "candidate"]) {
        const artifact = json(join(directories[arm], "artifact.json"))
        requireGate(
            artifact.mode === "timed",
            "ARTIFACT-INSTRUMENTATION",
            "scored memory cannot use a counter build",
        )
        inspectArtifact(
            join(directories[arm], artifact.tarball),
            artifact,
            "timed",
        ).cleanup()
        artifacts[arm] = { timed: artifact }
        for (const runtime of ["bun", "node"])
            installArtifact(
                join(directories[arm], artifact.tarball),
                artifact,
                join(directory, `consumer-${runtime}-${arm}`),
            )
    }
    return { artifacts, worker, wrapper, runner }
}
export function runMemoryProcess(
    root,
    { worker, wrapper, runner, artifacts },
    row,
    runtime,
    arm,
    pair,
) {
    requireGate(
        fileHash(worker) === runner.workerSha256 &&
            fileHash(wrapper) === runner.wrapperSha256,
        "MEMORY-RUNNER-HASH",
        "runner changed",
    )
    const consumer = join(
            root,
            "memory",
            `consumer-${runtime}-${arm}`,
            "node_modules/valdres",
        ),
        path = `memory/${row.id}-${runtime}-${pair}-${arm}.process.json`,
        artifact = artifacts[arm].timed
    assertInstalledArtifact(consumer, artifact)
    const process = captureCommand(
        [
            runtime,
            ...(runtime === "node" ? ["--expose-gc"] : []),
            worker,
            consumer,
            join(
                ROOT,
                "packages/valdres/test/selector-kernel-tournament/fixture-manifest.v3.json",
            ),
            row.id,
            wrapper,
        ],
        ROOT,
    )
    const ref = writeEvidence(root, path, process)
    requireGate(
        process.status === 0 && process.error === null,
        "MEMORY-PROCESS",
        process.stderr,
    )
    const sample = JSON.parse(process.stdout)
    const record = {
        id: row.id,
        runtime,
        pairId: String(pair),
        arm,
        sample,
        process: ref.path,
        processSha256: ref.sha256,
    }
    const summary = memoryProcessSummary(sample)
    return { record, summary }
}
export function collectMemory(
    root,
    { controlDirectory, headDirectory, provenance },
) {
    verifyProvenanceCurrent(provenance)
    const prepared = prepareMemory(root, { controlDirectory, headDirectory }),
        records = [],
        environments = []
    for (const row of manifest.memoryScenarios)
        for (const runtime of row.runtimes) {
            const lane = { id: row.id, runtime, pairs: [] }
            environments.push(lane)
            try {
                for (let pair = 0; pair < 5; pair++) {
                    const observation = {
                        pairId: String(pair),
                        before: environmentObservation(),
                        after: null,
                    }
                    lane.pairs.push(observation)
                    requireStableEnvironment(
                        observation.before,
                        observation.before,
                    )
                    for (const arm of manifest.stages.A.timingOrder[pair % 2]) {
                        const { record } = runMemoryProcess(
                            root,
                            prepared,
                            row,
                            runtime,
                            arm,
                            pair,
                        )
                        records.push(record)
                    }
                    observation.after = environmentObservation()
                    requireStableEnvironment(
                        observation.before,
                        observation.after,
                    )
                }
            } catch (error) {
                writeEvidence(
                    root,
                    `memory/${row.id}-${runtime}.invalid.json`,
                    {
                        kind: "invalid-whole-lane",
                        reason: error.message,
                        records: records.filter(
                            r => r.id === row.id && r.runtime === runtime,
                        ),
                        environment: lane,
                    },
                )
                throw error
            }
        }
    verifyProvenanceCurrent(provenance)
    writeEvidence(root, "memory/environments.json", environments)
    writeEvidence(
        root,
        "memory.ndjson",
        records.map(r => JSON.stringify(r) + "\n").join(""),
    )
    validateMemoryEvidence(root, records, { artifacts: prepared.artifacts })
    return decideMemory(records)
}
export function collectSizes(root, { controlDirectory, headDirectory, index }) {
    assertClean()
    checkInputs()
    const directories = { control: controlDirectory, candidate: headDirectory },
        measurements = {},
        processes = [],
        artifacts = {},
        reachability = {}
    for (const path of [
        manifest.stages.size.measurementScript,
        manifest.stages.size.baselineFile,
    ])
        writeEvidence(root, "size-authority/" + path, frozenInputBytes(path))
    for (const arm of ["control", "candidate"]) {
        const directory = directories[arm],
            artifact = json(join(directory, "artifact.json"))
        requireGate(
            artifact.mode === "timed",
            "ARTIFACT-INSTRUMENTATION",
            "size uses production artifact",
        )
        inspectArtifact(
            join(directory, artifact.tarball),
            artifact,
            "timed",
        ).cleanup()
        const process = captureCommand(
            [
                "bun",
                join(
                    root,
                    "size-authority",
                    manifest.stages.size.measurementScript,
                ),
                join(directory, artifact.tarball),
            ],
            ROOT,
        )
        const ref = writeEvidence(root, `size-${arm}.process.json`, process)
        measurements[arm] = validateSizeProcess(
            root,
            process,
            artifact,
            join(directory, artifact.tarball),
        )
        processes.push({ arm, process: ref.path, sha256: ref.sha256 })
        artifacts[arm] = { timed: artifact }
        reachability[arm] = packedRootReachability(
            join(directory, artifact.tarball),
            artifact,
        )
    }
    const value = {
        schemaVersion: 3,
        ...measurements,
        baseline: normalizeSizes(
            frozenInputJson(manifest.stages.size.baselineFile),
        ),
        processes,
    }
    writeEvidence(root, "root-reachability.json", reachability)
    writeEvidence(root, "sizes.json", value)
    validateSizeEvidence(root, value, { artifacts, index })
    return decideSizes(value.control, value.candidate, value.baseline)
}
