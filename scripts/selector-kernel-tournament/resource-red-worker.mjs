// Test-only resource adversaries. These mutate disposable packed fixtures;
// they never change a candidate or the production source tree.
import { appendFileSync, mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import {
    ROOT,
    assertClean,
    checkInputs,
    fileHash,
    json,
    requireGate,
} from "./inputs.mjs"
import {
    captureCommand,
    command,
    inspectArtifact,
    installArtifact,
} from "./artifact.mjs"
import { extractPackedArtifact } from "../../packages/valdres/test/performance/core-load/artifact.mjs"
import { buildLegacyWrappers } from "./legacy-wrappers.mjs"
import { writeEvidence } from "./evidence.mjs"
import { assertMemoryAbsolute } from "./resource-validation.mjs"
import { packedRootReachability } from "./reachability.mjs"
import { validateProcess } from "./process-evidence.mjs"

export function resourceAdversary(id, artifactDirectory, output, mode) {
    requireGate(["baseline", "mutation"].includes(mode), "RED-MODE", mode)
    requireGate(
        ["retained-memory-leak", "root-bundle-leakage"].includes(id),
        "RED-ID",
        id,
    )
    assertClean()
    checkInputs()
    mkdirSync(output)
    const metadata = json(join(artifactDirectory, "artifact.json"))
    const tarball = join(artifactDirectory, metadata.tarball)
    inspectArtifact(tarball, metadata, "timed").cleanup()
    writeEvidence(output, "input.json", {
        id,
        mode,
        artifactDirectory,
        metadata,
    })
    if (id === "retained-memory-leak") {
        const worker = join(output, "memory-worker.mjs")
        const wrapper = join(output, "factories.mjs")
        const build = captureCommand(
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
        )
        writeEvidence(output, "build.process.json", build)
        validateProcess(build)
        buildLegacyWrappers(wrapper)
        const consumer = join(output, "consumer")
        installArtifact(tarball, metadata, consumer)
        const process = captureCommand(
            [
                "node",
                "--expose-gc",
                worker,
                join(consumer, "node_modules/valdres"),
                join(
                    ROOT,
                    "packages/valdres/test/selector-kernel-tournament/fixture-manifest.v2.json",
                ),
                "M-LIVE-SELECTOR-GRAPHS",
                wrapper,
                ...(mode === "mutation" ? ["retain-node"] : []),
            ],
            ROOT,
        )
        writeEvidence(output, "memory.process.json", process)
        validateProcess(process)
        return assertMemoryAbsolute(JSON.parse(process.stdout))
    }
    if (mode === "baseline") return packedRootReachability(tarball, metadata)
    const extracted = extractPackedArtifact(tarball)
    try {
        const evidence = join(
            extracted.packageRoot,
            "test/selector-kernel-tournament/evidence.js",
        )
        mkdirSync(dirname(evidence), { recursive: true })
        appendFileSync(
            evidence,
            "export const diagnosticEvidence = Object.freeze({});\n",
        )
        appendFileSync(
            join(extracted.packageRoot, "dist/index.js"),
            "\nimport '../test/selector-kernel-tournament/evidence.js';\n",
        )
        const mutatedTarball = join(output, "root-evidence-import.tgz")
        command(
            ["tar", "-czf", mutatedTarball, "package"],
            dirname(extracted.packageRoot),
        )
        const mutated = extractPackedArtifact(mutatedTarball)
        let updated
        try {
            // Recompute identity to exercise the import gate, rather than an
            // incidental stale-tarball or stale-dist hash failure.
            updated = {
                ...metadata,
                tarball: "root-evidence-import.tgz",
                tarballSha256: fileHash(mutatedTarball),
                productionEntrySha256: mutated.entrySha256,
                distTreeSha256: mutated.distTreeSha256,
            }
        } finally {
            mutated.cleanup()
        }
        writeEvidence(output, "artifact.json", updated)
        return packedRootReachability(mutatedTarball, updated)
    } finally {
        extracted.cleanup()
    }
}

if (import.meta.main) {
    try {
        console.log(JSON.stringify(resourceAdversary(...process.argv.slice(2))))
    } catch (error) {
        console.error(error.message)
        process.exitCode = 1
    }
}
