import { recordedRoot } from "./recorded-root.mjs"
import { assertInstalledArtifact } from "./artifact.mjs"
import { join } from "node:path"
import {
    ROOT,
    manifest,
    json,
    fileHash,
    requireGate,
    exactRows,
} from "./inputs.mjs"
import { captureCommand, installArtifact } from "./artifact.mjs"
import { writeEvidence, evidencePath, strictKeys, same } from "./evidence.mjs"
import { validateProcess } from "./process-evidence.mjs"
import {
    readFixture,
    assertExpectedResult,
} from "../../packages/valdres/test/performance/core-load/lib.mjs"
const fixture = join(
        ROOT,
        "packages/valdres/test/performance/core-load/fixture.v1.json",
    ),
    worker = join(
        ROOT,
        "packages/valdres/test/performance/core-load/run-sample.mjs",
    )
const scenarios = ["initial-view-core", "writes", "no-writes"]
function argv(consumer, scenario, authorityRoot = ROOT) {
    return [
        "node",
        join(
            authorityRoot,
            "packages/valdres/test/performance/core-load/run-sample.mjs",
        ),
        "--package-root",
        join(consumer, "node_modules/valdres"),
        "--fixture",
        join(
            authorityRoot,
            "packages/valdres/test/performance/core-load/fixture.v1.json",
        ),
        "--adapter",
        "v1",
        "--scenario",
        scenario,
        "--mode",
        "oracle",
        "--role",
        "baseline",
        "--label",
        "tournament semantic preflight",
    ]
}
export function runCorePreflight(root, artifactDirectory, directory) {
    const artifact = json(join(artifactDirectory, "artifact.json"))
    requireGate(
        artifact.mode === "timed",
        "CORE-PREFLIGHT",
        "public oracle uses production artifact",
    )
    const consumer = join(root, directory, "consumer")
    installArtifact(
        join(artifactDirectory, artifact.tarball),
        artifact,
        consumer,
    )
    const rows = []
    for (const scenario of scenarios) {
        assertInstalledArtifact(
            join(consumer, "node_modules/valdres"),
            artifact,
        )
        const path = join(directory, scenario + ".process.json"),
            process = captureCommand(argv(consumer, scenario), ROOT)
        const evidence = writeEvidence(root, path, process)
        validateProcess(process)
        const sample = JSON.parse(process.stdout)
        assertExpectedResult(
            sample,
            readFixture(fixture),
            scenario,
            "CORE-PREFLIGHT",
        )
        rows.push({ scenario, process: path, sha256: evidence.sha256 })
    }
    const value = {
        schemaVersion: 3,
        artifactSha256: artifact.tarballSha256,
        directory,
        rows,
    }
    writeEvidence(root, join(directory, "preflight.json"), value)
    return join(directory, "preflight.json")
}
export function validateCorePreflight(root, path, artifact) {
    const value = json(evidencePath(root, path))
    strictKeys(
        value,
        ["schemaVersion", "artifactSha256", "directory", "rows"],
        "CORE-PREFLIGHT-SCHEMA",
    )
    requireGate(
        value.schemaVersion === 3 &&
            value.artifactSha256 === artifact.tarballSha256,
        "CORE-PREFLIGHT-IDENTITY",
        "wrong artifact",
    )
    exactRows(
        value.rows.map(r => r.scenario),
        scenarios,
        "CORE-PREFLIGHT-INVENTORY",
    )
    for (const row of value.rows) {
        strictKeys(
            row,
            ["scenario", "process", "sha256"],
            "CORE-PREFLIGHT-SCHEMA",
        )
        requireGate(
            fileHash(evidencePath(root, row.process)) === row.sha256,
            "CORE-PREFLIGHT-HASH",
            row.scenario,
        )
        assertInstalledArtifact(
            join(root, value.directory, "consumer/node_modules/valdres"),
            artifact,
        )
        const process = json(evidencePath(root, row.process))
        validateProcess(process, {
            argv: argv(
                join(root, value.directory, "consumer"),
                row.scenario,
                recordedRoot(),
            ),
        })
        const sample = JSON.parse(process.stdout)
        requireGate(
            sample.target.entrySha256 === artifact.productionEntrySha256 &&
                sample.target.distTreeSha256 === artifact.distTreeSha256 &&
                sample.process.pid === process.pid &&
                sample.fixtureSha256 === fileHash(fixture),
            "CORE-PREFLIGHT-IDENTITY",
            "loaded inputs differ",
        )
        assertExpectedResult(
            sample,
            readFixture(fixture),
            row.scenario,
            "CORE-PREFLIGHT",
        )
        requireGate(
            sample.mode === "oracle" && sample.elapsedMs === null,
            "CORE-PREFLIGHT-MODE",
            "oracle cannot supply timing",
        )
    }
    return value
}
export function absoluteCoreGate(rows) {
    const ceilings = readFixture(fixture).measurement.ceilingsMs
    return rows
        .filter(r => r.id.startsWith("P-CORE-"))
        .map(row => ({
            id: row.id,
            runtime: row.runtime,
            ceilingsMs: ceilings,
            baseline: {
                p50Ms: row.baselineP50 / 1e6,
                p95Ms: row.baselineP95 / 1e6,
            },
            candidate: {
                p50Ms: row.candidateP50 / 1e6,
                p95Ms: row.candidateP95 / 1e6,
            },
            status:
                row.candidateP50 / 1e6 <= ceilings.p50 &&
                row.candidateP95 / 1e6 <= ceilings.p95
                    ? "pass"
                    : "fail",
        }))
}
