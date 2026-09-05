import { assertInstalledArtifact } from "./artifact.mjs"
import { mkdirSync, writeFileSync, existsSync } from "node:fs"
import { join, resolve } from "node:path"
import {
    ROOT,
    assertClean,
    checkInputs,
    json,
    manifest,
    requireGate,
    fileHash,
    git,
} from "./inputs.mjs"
import {
    command,
    captureCommand,
    installArtifact,
    inspectArtifact,
} from "./artifact.mjs"
export function runSemantics({
    artifactDirectory,
    output,
    repeats = 2,
    stage = "A",
}) {
    assertClean()
    const inputs = checkInputs()
    const head = git(["rev-parse", "HEAD"])
    requireGate(["C", "A"].includes(stage), "SEMANTIC-STAGE", stage)
    const caseIds = manifest.semanticCases
        .filter(row => row.requiredAt.includes(stage))
        .map(row => row.id)
    requireGate(
        repeats === 2,
        "SEMANTIC-DETERMINISM",
        "two complete process replays are required",
    )
    requireGate(!existsSync(output), "EVIDENCE-IMMUTABLE", output)
    mkdirSync(output, { recursive: true })
    const artifact = json(join(artifactDirectory, "artifact.json"))
    const tarball = join(artifactDirectory, artifact.tarball)
    inspectArtifact(tarball, artifact, artifact.mode).cleanup()
    const worker = join(output, "semantic-worker.mjs")
    writeFileSync(
        join(output, "worker-build.log"),
        command(
            [
                "bun",
                "build",
                join(
                    ROOT,
                    "scripts/selector-kernel-tournament/semantic-worker.mjs",
                ),
                "--target=node",
                `--outfile=${worker}`,
            ],
            ROOT,
        ),
    )
    const processRows = []
    for (const runtime of ["bun", "node"]) {
        const consumer = join(output, `consumer-${runtime}`),
            foreign = join(output, `foreign-${runtime}`)
        installArtifact(tarball, artifact, consumer, artifact.mode)
        installArtifact(tarball, artifact, foreign, artifact.mode)
        let previous
        for (let repeat = 0; repeat < repeats; repeat++) {
            const stem = `${runtime}-${repeat}`
            const args = [
                runtime,
                worker,
                join(consumer, "node_modules/valdres"),
                join(foreign, "node_modules/valdres"),
                join(
                    ROOT,
                    "packages/valdres/test/selector-kernel-tournament/fixture-manifest.v3.json",
                ),
                join(output, `${stem}.ndjson`),
                stage,
                ...(stage === "C" ? [caseIds.join(",")] : []),
            ]
            for (const directory of [consumer, foreign])
                assertInstalledArtifact(
                    join(directory, "node_modules/valdres"),
                    artifact,
                )
            const processResult = captureCommand(args, ROOT, {
                timeout: 600000,
            })
            writeFileSync(
                join(output, `${stem}.process.json`),
                JSON.stringify(processResult, null, 2) + "\n",
            )
            writeFileSync(
                join(output, `${stem}.stdout.json`),
                processResult.stdout,
            )
            writeFileSync(join(output, `${stem}.stderr`), processResult.stderr)
            requireGate(
                processResult.status === 0 && !processResult.error,
                "SEMANTIC-PROCESS",
                `${stem}: ${processResult.stderr}`,
            )
            const result = JSON.parse(processResult.stdout)
            requireGate(
                result.rows.length === caseIds.length,
                "SEMANTIC-INVENTORY",
                stem,
            )
            const hashes = result.rows.map(row => [row.id, row.traceSha256])
            if (previous)
                requireGate(
                    JSON.stringify(hashes) === JSON.stringify(previous),
                    "SEMANTIC-DETERMINISM",
                    stem,
                )
            previous = hashes
            processRows.push({
                runtime,
                repeat,
                mode: result.mode,
                rows: result.rows,
                process: `${stem}.process.json`,
                raw: `${stem}.ndjson`,
                rawSha256: fileHash(join(output, `${stem}.ndjson`)),
            })
        }
    }
    assertClean()
    requireGate(
        git(["rev-parse", "HEAD"]) === head,
        "PROVENANCE-HARNESS-HEAD",
        "harness changed",
    )
    const result = {
        schemaVersion: 3,
        kind: "semantic-evidence",
        stage,
        inputs,
        artifact,
        workerSha256: fileHash(worker),
        processRows,
    }
    writeFileSync(
        join(output, "semantics.json"),
        JSON.stringify(result, null, 2) + "\n",
    )
    return result
}
export function runFrozenFamily(output) {
    assertClean()
    checkInputs()
    requireGate(!existsSync(output), "EVIDENCE-IMMUTABLE", output)
    mkdirSync(output, { recursive: true })
    const files = manifest.productLanes.family.protectedPaths.filter(p =>
        p.endsWith(".test.ts"),
    )
    const result = captureCommand(
        ["bun", "test", "--reporter=dots", ...files.map(p => resolve(ROOT, p))],
        join(ROOT, "packages/valdres"),
    )
    writeFileSync(
        join(output, "family.process.json"),
        JSON.stringify(result, null, 2) + "\n",
    )
    requireGate(
        result.status === 0 && !result.error,
        "FAMILY-COMPATIBILITY",
        result.stderr,
    )
    return {
        status: "pass",
        scoring: false,
        files: files.map(path => ({
            path,
            sha256: fileHash(join(ROOT, path)),
        })),
        process: "family.process.json",
    }
}
if (import.meta.main) {
    const [action, artifactDirectory, output] = process.argv.slice(2)
    if (action === "run")
        console.log(JSON.stringify(runSemantics({ artifactDirectory, output })))
    else if (action === "family")
        console.log(JSON.stringify(runFrozenFamily(artifactDirectory)))
    else
        throw Error(
            "usage: semantics.mjs run ARTIFACT NEW_OUTPUT | family NEW_OUTPUT",
        )
}
