import { assertInstalledArtifact } from "./artifact.mjs"
import { mkdirSync, existsSync, writeFileSync, cpSync } from "node:fs"
import { join } from "node:path"
import {
    ROOT,
    assertClean,
    checkInputs,
    manifest,
    json,
    fileHash,
    requireGate,
} from "./inputs.mjs"
import {
    command,
    captureCommand,
    installArtifact,
    inspectArtifact,
} from "./artifact.mjs"
import { buildLegacyWrappers } from "./legacy-wrappers.mjs"
import {
    validateWorkloadExpectations,
    validateWorkloadSample,
} from "./workload-validation.mjs"
export const EXPECTATIONS = join(
    ROOT,
    "packages/valdres/test/selector-kernel-tournament/workload-expectations.v2.json",
)
export function prepareWorkloads(output) {
    assertClean()
    checkInputs()
    requireGate(!existsSync(output), "EVIDENCE-IMMUTABLE", output)
    mkdirSync(output, { recursive: true })
    const expected = json(EXPECTATIONS)
    validateWorkloadExpectations(expected, manifest)
    const worker = join(output, "worker.mjs"),
        wrapper = join(output, "legacy-wrappers.mjs")
    const wrapperInputs = buildLegacyWrappers(wrapper)
    cpSync(
        join(
            ROOT,
            "packages/valdres/test/performance/core-load/initial-view-core.v1.json",
        ),
        join(output, "initial-view-core.v1.json"),
    )
    writeFileSync(
        join(output, "build.log"),
        command(
            [
                "bun",
                "build",
                join(
                    ROOT,
                    "scripts/selector-kernel-tournament/workload-worker.mjs",
                ),
                "--target=node",
                `--outfile=${worker}`,
            ],
            ROOT,
        ),
    )
    return {
        worker,
        wrapper,
        wrapperInputs,
        workerSha256: fileHash(worker),
        expected,
        expectedSha256: fileHash(EXPECTATIONS),
    }
}
export function runWorkloadProcess({
    runner,
    consumer,
    artifact,
    row,
    runtime,
    mode,
    output,
}) {
    requireGate(!existsSync(output), "EVIDENCE-IMMUTABLE", output)
    requireGate(
        fileHash(runner.worker) === runner.workerSha256 &&
            fileHash(runner.wrapper) === runner.wrapperInputs.generatedSha256 &&
            fileHash(EXPECTATIONS) === runner.expectedSha256,
        "PROVENANCE-WORKLOAD-HASH",
        "runner or expectations changed",
    )
    const packageRoot = join(consumer, "node_modules/valdres")
    assertInstalledArtifact(packageRoot, artifact)
    const args = [
        runtime,
        ...(runtime === "node" && mode === "counter" ? ["--expose-gc"] : []),
        runner.worker,
        packageRoot,
        join(
            ROOT,
            "packages/valdres/test/selector-kernel-tournament/fixture-manifest.v2.json",
        ),
        row.id,
        mode,
        runner.wrapper,
        join(ROOT, "packages/valdres/test/performance/core-load"),
        EXPECTATIONS,
    ]
    const processResult = captureCommand(args, ROOT, { timeout: 120000 })
    writeFileSync(output, JSON.stringify(processResult, null, 2) + "\n")
    requireGate(
        processResult.status === 0 && !processResult.error,
        "WORKLOAD-PROCESS",
        `${row.id}/${runtime}: ${processResult.stderr}`,
    )
    return validateWorkloadSample(JSON.parse(processResult.stdout), {
        row,
        runtime,
        mode,
        expected: runner.expected.rows.find(e => e.id === row.id),
        entrySha256: artifact.productionEntrySha256,
    })
}
export function checkWorkloadCorpus(artifactDirectory, output) {
    const runner = prepareWorkloads(output),
        artifact = json(join(artifactDirectory, "artifact.json")),
        tarball = join(artifactDirectory, artifact.tarball)
    inspectArtifact(tarball, artifact, artifact.mode).cleanup()
    const consumers = {}
    for (const runtime of ["bun", "node"]) {
        consumers[runtime] = join(output, `consumer-${runtime}`)
        installArtifact(tarball, artifact, consumers[runtime], artifact.mode)
    }
    const rows = []
    for (const row of manifest.performanceWorkloads)
        for (const runtime of row.runtimes)
            rows.push(
                runWorkloadProcess({
                    runner,
                    consumer: consumers[runtime],
                    artifact,
                    row,
                    runtime,
                    mode: artifact.mode,
                    output: join(output, `${row.id}-${runtime}.process.json`),
                }),
            )
    const result = {
        schemaVersion: 2,
        kind: "workload-corpus-validation",
        artifact,
        runner,
        rows,
    }
    writeFileSync(
        join(output, "corpus.json"),
        JSON.stringify(result, null, 2) + "\n",
    )
    return result
}
if (import.meta.main) {
    const [action, artifactDirectory, output] = process.argv.slice(2)
    requireGate(
        action === "check" && process.argv.length === 5,
        "WORKLOAD-CLI",
        "usage: workloads.mjs check ARTIFACT NEW_OUTPUT",
    )
    console.log(JSON.stringify(checkWorkloadCorpus(artifactDirectory, output)))
}
