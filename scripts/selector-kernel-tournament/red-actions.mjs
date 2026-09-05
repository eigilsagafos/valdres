import { mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs"
import { dirname, join } from "node:path"
import {
    ROOT,
    DIRECTORY,
    manifest,
    json,
    git,
    fileHash,
    assertClean,
    checkInputs,
    requireGate,
    verifyProtected,
} from "./inputs.mjs"
import {
    captureCommand,
    command,
    installArtifact,
    inspectArtifact,
    assertInstalledArtifact,
} from "./artifact.mjs"
import { writeEvidence } from "./evidence.mjs"
import { validateProcess } from "./process-evidence.mjs"
import { RED_CASES } from "./red-cases.mjs"
import { buildLegacyWrappers } from "./legacy-wrappers.mjs"
import { resourceAdversary } from "./resource-red-worker.mjs"
import {
    materializeSource,
    SOURCE_HARNESS,
    sourceMemoryCommand,
    assertSourceMemory,
} from "./source-memory.mjs"
import { validateWorkloadSample } from "./workload-validation.mjs"
import { assertTimingDuration } from "./timing-evidence.mjs"
import { decideTournament } from "../lib/paired-decision-tournament.ts"

function buildWorker(output, name) {
    const worker = join(output, name + ".mjs")
    const process = captureCommand(
        [
            "bun",
            "build",
            join(ROOT, "scripts/selector-kernel-tournament/" + name + ".mjs"),
            "--target=node",
            `--outfile=${worker}`,
        ],
        ROOT,
    )
    writeEvidence(output, name + ".build.process.json", process)
    validateProcess(process)
    return worker
}
function installed(directory, output, name) {
    const metadata = json(join(directory, "artifact.json"))
    const consumer = join(output, name)
    installArtifact(
        join(directory, metadata.tarball),
        metadata,
        consumer,
        metadata.mode,
    )
    return { packageRoot: join(consumer, "node_modules/valdres"), metadata }
}
export async function runRedCase({ id, variant, controlRoot, mode, output }) {
    assertClean()
    checkInputs()
    const row = RED_CASES.find(r => r.id === id && r.variant === variant)
    requireGate(
        row && ["baseline", "mutation"].includes(mode),
        "RED-ID",
        "unknown class, variant, or mode",
    )
    mkdirSync(output)
    const mutation = mode === "mutation"
    const timedDirectory = join(controlRoot, "artifacts/control-timed")
    const counterDirectory = join(controlRoot, "artifacts/control-counter")
    writeEvidence(output, "input.json", {
        schemaVersion: 3,
        foundationSha: git(["rev-parse", "HEAD"]),
        id,
        variant,
        mode,
        controlRoot,
        expectedGate: row.expectedGate,
    })
    if (/^[AC]-/.test(row.expectedGate)) {
        const counter = installed(counterDirectory, output, "counter")
        const foreign = installed(timedDirectory, output, "foreign")
        const worker = buildWorker(output, "semantic-worker")
        const process = captureCommand(
            [
                "node",
                worker,
                counter.packageRoot,
                foreign.packageRoot,
                join(ROOT, DIRECTORY, "fixture-manifest.v3.json"),
                join(output, "semantic.ndjson"),
                row.expectedGate,
                ...(mutation ? [variant] : []),
            ],
            ROOT,
            { timeout: 600000 },
        )
        writeEvidence(output, "semantic.process.json", process)
        if (process.status !== 0) {
            validateProcess(process, { success: false })
            requireGate(
                mutation &&
                    process.status === 1 &&
                    process.signal === null &&
                    process.error === null &&
                    process.stderr.includes(row.expectedGate + ":"),
                "RED-WRONG-FAILURE",
                process.stderr,
            )
            throw Error(process.stderr)
        }
        validateProcess(process)
        requireGate(!mutation, "RED-MUTATION-SURVIVED", variant)
        return { status: "pass", class: id, variant }
    }
    if (
        (id === "retained-memory-leak" && variant === "packed-paired") ||
        id === "root-bundle-leakage"
    )
        return resourceAdversary(
            id,
            timedDirectory,
            join(output, "resource"),
            mode,
        )
    if (id === "retained-memory-leak") {
        const metadata = json(join(timedDirectory, "artifact.json"))
        const source = materializeSource(
            join(timedDirectory, "source.tar"),
            metadata.gitSha,
        )
        try {
            if (mutation) {
                // Test-only disposable source archive. The exact harness and its
                // ceilings are unchanged. Hold real atom definitions and a 2 KiB
                // payload each to force both retained and release violations.
                const path = join(
                    source.directory,
                    "packages/valdres/src/atom.ts",
                )
                const before = readFileSync(path, "utf8")
                const anchor =
                    "    if (!options) return { equal, defaultValue }"
                requireGate(
                    before.split(anchor).length === 2,
                    "RED-SOURCE-ANCHOR",
                    "atom fixture drift",
                )
                const after = before.replace(
                    anchor,
                    `    if (!options) {\n        const retained = { equal, defaultValue }\n        const leak = ((globalThis as any).__tournamentRedRetainedAtoms ??= [])\n        leak.push({ retained, payload: new Array(256).fill(17) })\n        return retained\n    }`,
                )
                writeFileSync(path, after)
                writeEvidence(output, "source-mutation.json", {
                    path: "packages/valdres/src/atom.ts",
                    before,
                    after,
                    purpose: "test-only retained-node violation",
                })
            }
            requireGate(
                fileHash(join(source.directory, SOURCE_HARNESS)) ===
                    fileHash(join(ROOT, SOURCE_HARNESS)),
                "SOURCE-MEMORY-HARNESS",
                "red fixture changed harness",
            )
            const process = captureCommand(
                sourceMemoryCommand("node"),
                join(source.directory, "packages/valdres"),
            )
            writeEvidence(output, "source-memory.process.json", process)
            return assertSourceMemory(
                process,
                "node",
                "candidate",
                "source-memory.process.json",
            )
        } finally {
            rmSync(source.directory, { recursive: true, force: true })
        }
    }
    if (id === "frozen-family-path") {
        const archive = join(output, "foundation.tar")
        const foundation = git(["rev-parse", "HEAD"])
        command(
            ["git", "archive", "--format=tar", "--output", archive, foundation],
            ROOT,
        )
        const tree = join(output, "protected-tree")
        mkdirSync(tree)
        command(["tar", "-xf", archive, "-C", tree], ROOT)
        command(["git", "init", "-q"], tree)
        if (mutation) {
            const path = manifest.productLanes.family.protectedPaths[0]
            writeFileSync(
                join(tree, path),
                readFileSync(join(tree, path), "utf8") +
                    "\n// test-only frozen-path mutation\n",
            )
        }
        command(["git", "add", "."], tree)
        // Keep raw patch + full archive; remove only disposable Git metadata.
        try {
            return verifyProtected(tree, foundation)
        } finally {
            rmSync(join(tree, ".git"), { recursive: true, force: true })
        }
    }
    if (id === "deterministic-20-percent-slowdown") {
        const lanes = manifest.performanceWorkloads.flatMap(row =>
            row.runtimes.map(runtime => {
                const core = row.group === "packed-core-load"
                return {
                    id: row.id,
                    runtime,
                    core,
                    intended: false,
                    samples: Array.from({ length: core ? 50 : 24 }, (_, i) => {
                        const baseNs = 100000 + (i % 7) * 300
                        return {
                            pairId: String(i),
                            baseNs,
                            headNs: baseNs * (mutation ? 1.2 : 1),
                            baseBatchSize: 1,
                            headBatchSize: 1,
                        }
                    }),
                }
            }),
        )
        const decision = decideTournament(lanes, "A", { control: true })
        writeEvidence(output, "statistics-input.json", {
            schemaVersion: 3,
            kind: "test-only-deterministic-observations",
            lanes,
        })
        writeEvidence(output, "statistics-decision.json", decision)
        requireGate(
            decision.performanceStatus === "pass",
            "PERFORMANCE-REGRESSION",
            "deterministic paired fixture exceeds protected 1.10 budget",
        )
        return decision
    }
    const timed = installed(timedDirectory, output, "timed")
    if (id === "timed-instrumentation") {
        const counter = installed(counterDirectory, output, "counter")
        // Both are authenticated production packages; the only mutation is
        // submitting the counter build to the timed-artifact gate.
        const directory = mutation ? counterDirectory : timedDirectory
        const metadata = mutation
            ? { ...counter.metadata, mode: "timed" }
            : timed.metadata
        writeEvidence(output, "timed-submission.json", metadata)
        const inspected = inspectArtifact(
            join(directory, metadata.tarball),
            metadata,
            "timed",
        )
        inspected.cleanup()
        return { status: "pass" }
    }
    requireGate(id === "provenance-mismatch", "RED-ID", id)
    writeEvidence(
        output,
        "initial-view-core.v1.json",
        readFileSync(
            join(
                ROOT,
                "packages/valdres/test/performance/core-load/initial-view-core.v1.json",
            ),
            "utf8",
        ),
    )
    const worker = buildWorker(output, "workload-worker")
    const wrapper = join(output, "factories.mjs")
    buildLegacyWrappers(wrapper)
    const rowId = "P-NEG-ATOM-2048"
    assertInstalledArtifact(timed.packageRoot, timed.metadata)
    const process = captureCommand(
        [
            "node",
            worker,
            timed.packageRoot,
            join(ROOT, DIRECTORY, "fixture-manifest.v3.json"),
            rowId,
            "timed",
            wrapper,
            join(ROOT, "packages/valdres/test/performance/core-load"),
            join(ROOT, DIRECTORY, "workload-expectations.v3.json"),
        ],
        ROOT,
    )
    writeEvidence(output, "timing.process.json", process)
    validateProcess(process)
    const sample = JSON.parse(process.stdout)
    validateWorkloadSample(sample, {
        row: manifest.performanceWorkloads.find(r => r.id === rowId),
        runtime: "node",
        mode: "timed",
        expected: json(
            join(ROOT, DIRECTORY, "workload-expectations.v3.json"),
        ).rows.find(r => r.id === rowId),
        entrySha256: timed.metadata.productionEntrySha256,
    })
    const record = { durationNs: sample.durationNs + (mutation ? 1 : 0) }
    writeEvidence(output, "timing-record.json", record)
    assertTimingDuration(record, sample)
    return { status: "pass" }
}
