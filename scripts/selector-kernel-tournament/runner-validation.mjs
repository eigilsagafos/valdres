import { assertInstalledArtifact } from "./artifact.mjs"
import { mkdtempSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { ROOT, DIRECTORY, fileHash, requireGate, json } from "./inputs.mjs"
import { command } from "./artifact.mjs"
import { buildLegacyWrappers } from "./legacy-wrappers.mjs"
import { evidencePath, same, strictKeys } from "./evidence.mjs"
import { validateProcess } from "./process-evidence.mjs"
import { EXPECTATIONS } from "./workloads.mjs"
const compiled = new Map()
let expectedWrapper
export function verifyCompiledWorker(path, source) {
    const key = source + "/" + fileHash(join(ROOT, source))
    let hash = compiled.get(key)
    if (!hash) {
        const temporary = mkdtempSync(join(tmpdir(), "tournament-validator-"))
        try {
            const output = join(temporary, "worker.mjs")
            command(
                [
                    "bun",
                    "build",
                    join(ROOT, source),
                    "--target=node",
                    `--outfile=${output}`,
                ],
                ROOT,
            )
            hash = fileHash(output)
            compiled.set(key, hash)
        } finally {
            rmSync(temporary, { recursive: true, force: true })
        }
    }
    requireGate(
        fileHash(path) === hash,
        "PROVENANCE-WORKER-HASH",
        "worker does not reproduce from frozen source",
    )
}
export function validateWorkloadInvocation(
    root,
    process,
    { stage, id, runtime, arm, mode = "timed", artifact },
) {
    const directory =
        stage === "counter" ? "counter-workloads" : `timing-${stage}`
    const runner = json(evidencePath(root, directory + "/runner.json"))
    strictKeys(
        runner,
        [
            "worker",
            "wrapper",
            "wrapperInputs",
            "workerSha256",
            "expected",
            "expectedSha256",
        ],
        "PROVENANCE-RUNNER-SCHEMA",
    )
    same(
        runner.worker,
        join(root, directory, "worker.mjs"),
        "PROVENANCE-INVOCATION",
        "worker path",
    )
    same(
        runner.wrapper,
        join(root, directory, "legacy-wrappers.mjs"),
        "PROVENANCE-INVOCATION",
        "wrapper path",
    )
    verifyCompiledWorker(
        runner.worker,
        "scripts/selector-kernel-tournament/workload-worker.mjs",
    )
    requireGate(
        fileHash(runner.worker) === runner.workerSha256 &&
            fileHash(runner.wrapper) === runner.wrapperInputs.generatedSha256 &&
            fileHash(EXPECTATIONS) === runner.expectedSha256,
        "PROVENANCE-WORKLOAD-HASH",
        "workload inputs changed",
    )
    same(
        runner.expected,
        json(EXPECTATIONS),
        "PROVENANCE-WORKLOAD-HASH",
        "expectations differ",
    )
    if (!expectedWrapper) {
        const temp = mkdtempSync(
            join(tmpdir(), "tournament-wrapper-validation-"),
        )
        try {
            expectedWrapper = buildLegacyWrappers(
                join(temp, "legacy-wrappers.mjs"),
            )
        } finally {
            rmSync(temp, { recursive: true, force: true })
        }
    }
    same(
        expectedWrapper,
        runner.wrapperInputs,
        "PROVENANCE-WRAPPER-HASH",
        "wrapper differs from frozen source",
    )
    requireGate(
        fileHash(join(root, directory, "initial-view-core.v1.json")) ===
            fileHash(
                join(
                    ROOT,
                    "packages/valdres/test/performance/core-load/initial-view-core.v1.json",
                ),
            ),
        "PROVENANCE-FIXTURE-HASH",
        "initial view changed",
    )
    const consumer = join(
        root,
        directory,
        stage === "counter"
            ? `consumer-${runtime}`
            : `consumer-${runtime}-${arm}`,
        "node_modules/valdres",
    )
    assertInstalledArtifact(consumer, artifact)
    validateProcess(process, {
        argv: [
            runtime,
            ...(runtime === "node" && mode === "counter"
                ? ["--expose-gc"]
                : []),
            runner.worker,
            consumer,
            join(ROOT, DIRECTORY, "fixture-manifest.v2.json"),
            id,
            mode,
            runner.wrapper,
            join(ROOT, "packages/valdres/test/performance/core-load"),
            EXPECTATIONS,
        ],
    })
}
