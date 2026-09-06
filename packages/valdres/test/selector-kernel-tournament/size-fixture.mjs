// Disposable size-only artifacts, never candidate or qualification evidence.
import { mkdirSync, writeFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { createHash } from "node:crypto"
import {
    command,
    captureCommand,
} from "../../../../scripts/selector-kernel-tournament/artifact.mjs"
import { extractPackedArtifact } from "../performance/core-load/artifact.mjs"
import {
    ROOT,
    manifest,
    frozenInputBytes,
    frozenInputJson,
    fileHash,
    json,
} from "../../../../scripts/selector-kernel-tournament/inputs.mjs"
import { writeEvidence } from "../../../../scripts/selector-kernel-tournament/evidence.mjs"
import {
    normalizeSizes,
    parseSizeOutput,
} from "../../../../scripts/selector-kernel-tournament/resource-evidence.mjs"
import { packedRootReachability } from "../../../../scripts/selector-kernel-tournament/reachability.mjs"
import { collectSizes } from "../../../../scripts/selector-kernel-tournament/resources.mjs"
export function sizeFixture(root, variant = "passing", collect = false) {
    const index = { artifacts: {} },
        artifacts = {},
        measurements = {},
        processes = [],
        reachability = {}
    if (!collect)
        for (const path of [
            manifest.stages.size.measurementScript,
            manifest.stages.size.baselineFile,
        ])
            writeEvidence(
                root,
                "size-authority/" + path,
                frozenInputBytes(path),
            )
    for (const arm of ["control", "candidate"]) {
        const directory = join(root, "artifacts", arm),
            packageRoot = join(directory, "package")
        const pkg = {
            name: "valdres",
            version: "1.0.0-beta.36",
            type: "module",
            exports: {
                ".": "./dist/index.js",
                "./inspect": "./dist/inspect.js",
                "./equality": "./dist/equality.js",
                "./adapter-internals/v1": "./dist/adapter-internals/v1.js",
            },
        }
        const baseline = frozenInputJson(manifest.stages.size.baselineFile)
        for (const path of Object.keys(baseline.distFiles)) {
            const target = join(packageRoot, "dist", path)
            mkdirSync(dirname(target), { recursive: true })
            let source =
                "export const atom=1, selector=2, store=3, family=4, deepEqual=5;\n"
            if (
                arm === "candidate" &&
                variant === "per-file" &&
                path === "inspect.js"
            )
                source += "/*" + "x".repeat(30000) + "*/\n"
            writeFileSync(target, source)
        }
        writeFileSync(join(packageRoot, "package.json"), JSON.stringify(pkg))
        if (arm === "candidate" && variant === "oversized")
            writeFileSync(
                join(packageRoot, "size-only-padding.txt"),
                Array.from({ length: 12000 }, (_, i) =>
                    createHash("sha256")
                        .update("size-fixture-" + i)
                        .digest("hex"),
                ).join("\n"),
            )
        const tarball = join(directory, "fixture.tgz")
        command(["tar", "-czf", tarball, "package"], directory)
        const extracted = extractPackedArtifact(tarball)
        const metadata = {
            schemaVersion: 3,
            mode: "timed",
            repositoryDirty: false,
            gitSha: "1".repeat(40),
            tarball: "fixture.tgz",
            tarballSha256: fileHash(tarball),
            productionEntrySha256: extracted.entrySha256,
            distTreeSha256: extracted.distTreeSha256,
        }
        extracted.cleanup()
        writeEvidence(root, `artifacts/${arm}/artifact.json`, metadata)
        artifacts[arm] = { timed: metadata }
        index.artifacts[arm] = { timed: `artifacts/${arm}/artifact.json` }
        if (collect) continue
        const process = captureCommand(
            [
                "bun",
                join(
                    root,
                    "size-authority",
                    manifest.stages.size.measurementScript,
                ),
                tarball,
            ],
            ROOT,
        )
        const ref = writeEvidence(root, `size-${arm}.process.json`, process)
        processes.push({ arm, process: ref.path, sha256: ref.sha256 })
        measurements[arm] = normalizeSizes(parseSizeOutput(process.stdout))
        reachability[arm] = packedRootReachability(tarball, metadata)
    }
    if (collect) {
        collectSizes(root, {
            controlDirectory: join(root, "artifacts/control"),
            headDirectory: join(root, "artifacts/candidate"),
            index,
        })
        return { value: json(join(root, "sizes.json")), artifacts, index }
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
    return { value, artifacts, index }
}
