import { join } from "node:path"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { buildLegacyWrappers } from "./legacy-wrappers.mjs"
import {
    ROOT,
    DIRECTORY,
    manifest,
    json,
    fileHash,
    requireGate,
    exactRows,
} from "./inputs.mjs"
import { strictKeys, same, evidencePath } from "./evidence.mjs"
import { validateProcess } from "./process-evidence.mjs"
import { verifyCompiledWorker } from "./runner-validation.mjs"
export function normalizeSizes(value) {
    strictKeys(
        value,
        ["bun", "dist", "distFiles", "packed", "fixtures"],
        "SIZE-METRICS",
    )
    requireGate(
        value.bun === json(join(ROOT, manifest.stages.size.baselineFile)).bun &&
            value.bun === Bun.version,
        "SIZE-VERSION",
        "size toolchain differs from frozen baseline",
    )
    for (const size of Object.values(value.distFiles))
        strictKeys(size, ["raw", "gzip"], "SIZE-METRICS")
    const metrics = { dist: value.dist, packed: value.packed }
    for (const [path, size] of Object.entries(value.distFiles)) {
        const id = /^chunk-[^/]+\.js$/.test(path)
            ? "dist:root-shared"
            : /^development\/chunk-[^/]+\.js$/.test(path)
              ? "dist:development-shared"
              : "dist:" + path
        if (id.endsWith("-shared")) {
            metrics[id] ??= { raw: 0, gzip: 0 }
            metrics[id].raw += size.raw
            metrics[id].gzip += size.gzip
        } else {
            requireGate(!metrics[id], "SIZE-METRICS", "duplicate file")
            metrics[id] = size
        }
    }
    for (const [name, size] of Object.entries(value.fixtures))
        metrics["fixture:" + name] = size
    for (const size of Object.values(metrics)) {
        strictKeys(size, ["raw", "gzip"], "SIZE-METRICS")
        requireGate(
            Number.isSafeInteger(size.raw) &&
                size.raw >= 0 &&
                Number.isSafeInteger(size.gzip) &&
                size.gzip >= 0,
            "SIZE-METRICS",
            "invalid bytes",
        )
    }
    return metrics
}
export function parseSizeOutput(stdout) {
    const result = {
        bun: Bun.version,
        dist: null,
        distFiles: {},
        packed: null,
        fixtures: {},
    }
    const found = new Set()
    for (const line of stdout.split("\n")) {
        const match = /^\s*(.+?)\s+raw (\d+)\s+gzip (\d+)$/.exec(line)
        if (!match) continue
        const [, name, raw, gzip] = match
        requireGate(!found.has(name), "SIZE-METRICS", "duplicate metric")
        found.add(name)
        const value = { raw: Number(raw), gzip: Number(gzip) }
        if (name === "dist total") result.dist = value
        else if (name === "packed package") result.packed = value
        else if (name.startsWith("fixture "))
            result.fixtures[name.slice(8).trim()] = value
        else result.distFiles[name] = value
    }
    requireGate(
        result.dist && result.packed && Object.keys(result.fixtures).length > 0,
        "SIZE-METRICS",
        "missing measurement output",
    )
    return result
}
export function validateSizeEvidence(root, value, { artifacts, index }) {
    strictKeys(
        value,
        ["schemaVersion", "control", "candidate", "baseline", "processes"],
        "SIZE-SCHEMA",
    )
    requireGate(value.schemaVersion === 2, "SIZE-SCHEMA", "version")
    same(
        value.baseline,
        normalizeSizes(json(join(ROOT, manifest.stages.size.baselineFile))),
        "SIZE-BASELINE",
        "frozen size baseline changed",
    )
    exactRows(
        value.processes.map(p => p.arm),
        ["control", "candidate"],
        "SIZE-PROCESSES",
    )
    for (const ref of value.processes) {
        strictKeys(ref, ["arm", "process", "sha256"], "SIZE-SCHEMA")
        requireGate(
            fileHash(evidencePath(root, ref.process)) === ref.sha256,
            "SIZE-PROCESS-HASH",
            ref.arm,
        )
        const process = json(evidencePath(root, ref.process)),
            metadata = artifacts[ref.arm].timed,
            artifactPath = index.artifacts[ref.arm].timed
        const tarball = join(
            root,
            artifactPath.slice(0, artifactPath.lastIndexOf("/")),
            metadata.tarball,
        )
        validateProcess(process, {
            argv: [
                "bun",
                join(ROOT, manifest.stages.size.measurementScript),
                tarball,
            ],
        })
        same(
            value[ref.arm],
            normalizeSizes(parseSizeOutput(process.stdout)),
            "PROVENANCE-RESULT-ROW",
            "size summary differs from process",
        )
        exactRows(
            Object.keys(value[ref.arm]),
            Object.keys(value.baseline),
            "SIZE-METRICS",
        )
    }
}
export function validateMemoryEvidence(root, records, { artifacts }) {
    if (!records.length) return
    const runner = json(evidencePath(root, "memory/runner.json"))
    strictKeys(
        runner,
        ["workerSha256", "wrapperSha256", "sourceSha256"],
        "MEMORY-RUNNER",
    )
    const worker = evidencePath(root, "memory/worker.mjs"),
        wrapper = evidencePath(root, "memory/factories.mjs")
    requireGate(
        fileHash(worker) === runner.workerSha256 &&
            fileHash(wrapper) === runner.wrapperSha256 &&
            runner.sourceSha256 ===
                fileHash(join(ROOT, manifest.memoryScenarios[0].sourceTest)),
        "MEMORY-RUNNER-HASH",
        "memory sources changed",
    )
    verifyCompiledWorker(
        worker,
        "scripts/selector-kernel-tournament/memory-worker.mjs",
    )
    const temporary = mkdtempSync(join(tmpdir(), "tournament-memory-wrapper-"))
    try {
        requireGate(
            buildLegacyWrappers(join(temporary, "factories.mjs"))
                .generatedSha256 === runner.wrapperSha256,
            "MEMORY-RUNNER-HASH",
            "factory does not reproduce from frozen source",
        )
    } finally {
        rmSync(temporary, { recursive: true, force: true })
    }
    const seen = new Set()
    let end = ""
    for (const record of records) {
        requireGate(
            !seen.has(record.process),
            "MEMORY-PROCESS",
            "process reused",
        )
        seen.add(record.process)
        requireGate(
            fileHash(evidencePath(root, record.process)) ===
                record.processSha256,
            "PROVENANCE-MEMORY-HASH",
            record.process,
        )
        const process = json(evidencePath(root, record.process)),
            consumer = join(
                root,
                "memory",
                `consumer-${record.runtime}-${record.arm}`,
                "node_modules/valdres",
            )
        validateProcess(process, {
            argv: [
                record.runtime,
                ...(record.runtime === "node" ? ["--expose-gc"] : []),
                worker,
                consumer,
                join(ROOT, DIRECTORY, "fixture-manifest.v2.json"),
                record.id,
                wrapper,
            ],
        })
        requireGate(
            fileHash(join(consumer, "dist/index.js")) ===
                artifacts[record.arm].timed.productionEntrySha256,
            "PROVENANCE-ENTRY-HASH",
            "memory used wrong artifact",
        )
        same(
            JSON.parse(process.stdout),
            record.sample,
            "PROVENANCE-RESULT-ROW",
            "memory summary differs",
        )
        requireGate(
            process.pid === record.sample.pid &&
                (!end || Date.parse(process.startedAt) >= Date.parse(end)),
            "MEMORY-PROCESS",
            "PID or process order",
        )
        end = process.endedAt
    }
}
