import { recordedRoot } from "./recorded-root.mjs"
// The unchanged direct-source harness is a separate measurement domain. It is
// never compiled together with the packed runner or an observation plugin.
import {
    mkdtempSync,
    mkdirSync,
    existsSync,
    symlinkSync,
    rmSync,
    readFileSync,
} from "node:fs"
import { stripVTControlCharacters } from "node:util"
import { dirname, join, isAbsolute } from "node:path"
import { tmpdir } from "node:os"
import {
    ROOT,
    frozenInputBytes,
    sha256,
    manifest,
    git,
    fileHash,
    json,
    requireGate,
    exactRows,
} from "./inputs.mjs"
import { captureCommand, command } from "./artifact.mjs"
import { writeEvidence, evidencePath, strictKeys, same } from "./evidence.mjs"
import { validateProcess } from "./process-evidence.mjs"

export const SOURCE_HARNESS = manifest.stages.sourceMemory.harness
export function sourceMemoryCommand(runtime, authorityRoot = ROOT) {
    requireGate(
        ["bun", "node"].includes(runtime),
        "SOURCE-MEMORY-RUNTIME",
        runtime,
    )
    return runtime === "bun"
        ? [
              "bun",
              "test",
              "--timeout",
              "120000",
              "--concurrency",
              "1",
              "./test/performance/architecture.memory.ts",
          ]
        : [
              "env",
              "NODE_OPTIONS=--expose-gc",
              "node",
              join(authorityRoot, "node_modules/vitest/vitest.mjs"),
              "run",
              "--config",
              "vitest.memory.config.ts",
              "./test/performance/architecture.memory.ts",
          ]
}
export function sourceSnapshot(directory, commit) {
    return sha256(
        JSON.stringify(
            git(["ls-tree", "-r", "--name-only", commit])
                .split("\n")
                .map(path => ({
                    path,
                    sha256: fileHash(join(directory, path)),
                })),
        ),
    )
}
export function sourceMemoryWorkingDirectory(root, arm) {
    requireGate(
        isAbsolute(root) && ["control", "candidate"].includes(arm),
        "SOURCE-MEMORY-CONTEXT",
        "absolute evidence root and known arm required",
    )
    return join(root, "source-memory", arm + "-source", "packages/valdres")
}
export function materializeSource(archive, commit, output) {
    if (output !== undefined) {
        requireGate(
            isAbsolute(output) && !existsSync(output),
            "SOURCE-MEMORY-CONTEXT",
            "new absolute source directory required",
        )
        mkdirSync(output, { recursive: true })
    }
    const directory =
        output ?? mkdtempSync(join(tmpdir(), "tournament-source-memory-"))
    command(["tar", "-xf", archive, "-C", directory], ROOT)
    const snapshot = sourceSnapshot(directory, commit)
    requireGate(
        fileHash(join(directory, SOURCE_HARNESS)) ===
            sha256(frozenInputBytes(SOURCE_HARNESS)),
        "SOURCE-MEMORY-HARNESS",
        "frozen harness changed",
    )
    symlinkSync(
        join(ROOT, "node_modules"),
        join(directory, "node_modules"),
        "dir",
    )
    return { directory, snapshot }
}
export function sourceMemoryRows(process, runtime, arm, rawEvidence) {
    const observations = stripVTControlCharacters(
        process.stdout + "\n" + process.stderr,
    )
        .split("\n")
        .filter(line => line.trim().startsWith('{"scenario":'))
        .map(line => JSON.parse(line.trim()))
    exactRows(
        observations.map(row => row.scenario),
        manifest.sourceMemoryScenarios.map(row => row.name),
        "SOURCE-MEMORY-INVENTORY",
    )
    return observations.map(row => {
        strictKeys(
            row,
            [
                "scenario",
                "runtime",
                "units",
                "retainedBytes",
                "retainedBytesPerUnit",
                "releasedBytes",
            ],
            "SOURCE-MEMORY-SCHEMA",
        )
        const scenario = manifest.sourceMemoryScenarios.find(
            s => s.name === row.scenario,
        )
        requireGate(
            row.runtime === runtime &&
                row.units === scenario.units &&
                [row.retainedBytes, row.releasedBytes].every(
                    n => Number.isSafeInteger(n) && n >= 0,
                ) &&
                row.retainedBytesPerUnit ===
                    Math.round(row.retainedBytes / row.units),
            "SOURCE-MEMORY-MEASUREMENT",
            row.scenario,
        )
        const limit = scenario.absoluteCeilings[runtime]
        const retained = row.retainedBytes / row.units
        return {
            domain: "source-absolute",
            id: scenario.id,
            runtime,
            arm,
            status:
                retained <= limit.retainedBytesPerUnit &&
                row.releasedBytes <= limit.releasedResidualBytes
                    ? "pass"
                    : "fail",
            unitCount: row.units,
            retainedBytes: row.retainedBytes,
            retainedBytesPerUnit: retained,
            releasedResidualBytes: row.releasedBytes,
            retainedBytesPerUnitCeiling: limit.retainedBytesPerUnit,
            releasedResidualBytesCeiling: limit.releasedResidualBytes,
            rawEvidence,
        }
    })
}
export function assertSourceMemory(
    process,
    runtime,
    arm,
    rawEvidence,
    authorityRoot = ROOT,
    blocking = true,
) {
    const rows = sourceMemoryRows(process, runtime, arm, rawEvidence)
    const passed = rows.every(row => row.status === "pass")
    requireGate(
        !blocking || passed,
        "MEMORY-ABSOLUTE",
        "source-absolute: " +
            rows
                .filter(r => r.status === "fail")
                .map(r => r.id)
                .join(","),
    )
    validateProcess(process, {
        argv: sourceMemoryCommand(runtime, authorityRoot),
        success: blocking || passed,
    })
    requireGate(
        process.signal === null &&
            process.error === null &&
            [0, 1].includes(process.status),
        "SOURCE-MEMORY-PROCESS",
        "crashed diagnostic process",
    )
    const output = stripVTControlCharacters(process.stdout + process.stderr)
    if (blocking || passed)
        requireGate(
            runtime === "bun"
                ? /8 pass\s+0 fail/.test(output)
                : /Tests\s+8 passed \(8\)/.test(output),
            "SOURCE-MEMORY-TESTS",
            "all eight original tests must pass",
        )
    // At C, complete absolute observations are diagnostic. The fixed invocation
    // and all eight measurements remain required even if an absolute limit fails.
    return rows
}
export function collectSourceMemory(root, { artifacts, index }) {
    const processes = [],
        rows = []
    for (const arm of ["control", "candidate"]) {
        const metadata = artifacts[arm].timed
        const archive = evidencePath(
            root,
            join(dirname(index.artifacts[arm].timed), "source.tar"),
        )
        requireGate(
            fileHash(archive) === metadata.sourceArchiveSha256,
            "SOURCE-MEMORY-ARCHIVE",
            arm,
        )
        const cwd = sourceMemoryWorkingDirectory(root, arm)
        const source = materializeSource(
            archive,
            metadata.gitSha,
            join(cwd, "../.."),
        )
        try {
            for (const runtime of ["bun", "node"]) {
                const process = captureCommand(
                    sourceMemoryCommand(runtime),
                    cwd,
                )
                const path = `source-memory/${arm}-${runtime}.process.json`
                const ref = writeEvidence(root, path, process)
                const after = sourceSnapshot(source.directory, metadata.gitSha)
                requireGate(
                    after === source.snapshot,
                    "SOURCE-MEMORY-SOURCE",
                    "source changed during run",
                )
                processes.push({
                    arm,
                    runtime,
                    process: path,
                    sha256: ref.sha256,
                    gitSha: metadata.gitSha,
                    sourceArchiveSha256: metadata.sourceArchiveSha256,
                    sourceSnapshotSha256: after,
                    harnessSha256: fileHash(
                        join(source.directory, SOURCE_HARNESS),
                    ),
                })
                rows.push(...assertSourceMemory(process, runtime, arm, path))
            }
        } finally {
            rmSync(source.directory, { recursive: true, force: true })
        }
    }
    const result = {
        schemaVersion: 3,
        domain: "source-absolute",
        processes,
        rows,
    }
    writeEvidence(root, "source-memory.json", result)
    return validateSourceMemory(root, result, { artifacts, index })
}
export function validateSourceMemory(
    root,
    value,
    { artifacts, index, blocking = true },
) {
    strictKeys(
        value,
        ["schemaVersion", "domain", "processes", "rows"],
        "SOURCE-MEMORY-SCHEMA",
    )
    requireGate(
        value.schemaVersion === 3 && value.domain === "source-absolute",
        "SOURCE-MEMORY-SCHEMA",
        "v3 source domain required",
    )
    exactRows(
        value.processes.map(p => p.arm + "/" + p.runtime),
        ["control/bun", "control/node", "candidate/bun", "candidate/node"],
        "SOURCE-MEMORY-PROCESSES",
    )
    const rows = [],
        seen = new Set()
    let end = ""
    for (const ref of value.processes) {
        strictKeys(
            ref,
            [
                "arm",
                "runtime",
                "process",
                "sha256",
                "gitSha",
                "sourceArchiveSha256",
                "sourceSnapshotSha256",
                "harnessSha256",
            ],
            "SOURCE-MEMORY-SCHEMA",
        )
        requireGate(
            !seen.has(ref.process),
            "SOURCE-MEMORY-PROCESSES",
            "process reused",
        )
        seen.add(ref.process)
        const metadata = artifacts[ref.arm].timed
        requireGate(
            ref.gitSha === metadata.gitSha &&
                ref.sourceArchiveSha256 === metadata.sourceArchiveSha256 &&
                ref.harnessSha256 === sha256(frozenInputBytes(SOURCE_HARNESS)),
            "SOURCE-MEMORY-IDENTITY",
            ref.arm,
        )
        const archive = evidencePath(
            root,
            join(dirname(index.artifacts[ref.arm].timed), "source.tar"),
        )
        requireGate(
            fileHash(archive) === ref.sourceArchiveSha256 &&
                fileHash(evidencePath(root, ref.process)) === ref.sha256,
            "SOURCE-MEMORY-HASH",
            ref.arm,
        )
        const source = materializeSource(archive, metadata.gitSha)
        try {
            requireGate(
                source.snapshot === ref.sourceSnapshotSha256,
                "SOURCE-MEMORY-SOURCE",
                "source snapshot differs from archive",
            )
        } finally {
            rmSync(source.directory, { recursive: true, force: true })
        }
        const process = json(evidencePath(root, ref.process))
        requireGate(
            process.cwd === sourceMemoryWorkingDirectory(root, ref.arm) &&
                (!end || Date.parse(process.startedAt) >= Date.parse(end)),
            "SOURCE-MEMORY-PROCESSES",
            "cwd or process order",
        )
        end = process.endedAt
        rows.push(
            ...assertSourceMemory(
                process,
                ref.runtime,
                ref.arm,
                ref.process,
                recordedRoot(),
                blocking,
            ),
        )
    }
    same(
        value.rows,
        rows,
        "PROVENANCE-RESULT-ROW",
        "source absolute summary differs from process",
    )
    return rows
}
