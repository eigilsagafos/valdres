import { recordedRoot } from "./recorded-root.mjs"
import { assertInstalledArtifact } from "./artifact.mjs"
import { join } from "node:path"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { buildLegacyWrappers } from "./legacy-wrappers.mjs"
import {
    ROOT,
    frozenInputBytes,
    frozenInputJson,
    sha256,
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
import { packedRootReachability } from "./reachability.mjs"
import { requireStableEnvironment } from "./provenance.mjs"
export function normalizeSizes(value) {
    strictKeys(
        value,
        ["bun", "dist", "distFiles", "packed", "fixtures"],
        "SIZE-METRICS",
    )
    requireGate(
        value.bun === frozenInputJson(manifest.stages.size.baselineFile).bun &&
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
    requireGate(value.schemaVersion === 3, "SIZE-SCHEMA", "version")
    same(
        value.baseline,
        normalizeSizes(frozenInputJson(manifest.stages.size.baselineFile)),
        "SIZE-BASELINE",
        "frozen size baseline changed",
    )
    exactRows(
        value.processes.map(p => p.arm),
        ["control", "candidate"],
        "SIZE-PROCESSES",
    )
    for (const path of [
        manifest.stages.size.measurementScript,
        manifest.stages.size.baselineFile,
    ])
        requireGate(
            fileHash(evidencePath(root, "size-authority/" + path)) ===
                sha256(frozenInputBytes(path)),
            "SIZE-AUTHORITY",
            path,
        )
    const reachability = json(evidencePath(root, "root-reachability.json"))
    strictKeys(
        reachability,
        ["control", "candidate"],
        "ARTIFACT-ROOT-REACHABILITY",
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
        same(
            reachability[ref.arm],
            packedRootReachability(tarball, metadata),
            "ARTIFACT-ROOT-REACHABILITY",
            "recorded root graph differs",
        )
        validateProcess(process, {
            cwd: recordedRoot(),
            argv: [
                "bun",
                join(
                    root,
                    "size-authority",
                    manifest.stages.size.measurementScript,
                ),
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
                sha256(
                    frozenInputBytes(manifest.memoryScenarios[0].sourceTest),
                ),
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
            cwd: recordedRoot(),
            argv: [
                record.runtime,
                ...(record.runtime === "node" ? ["--expose-gc"] : []),
                worker,
                consumer,
                join(recordedRoot(), DIRECTORY, "fixture-manifest.v3.json"),
                record.id,
                wrapper,
            ],
        })
        assertInstalledArtifact(consumer, artifacts[record.arm].timed)
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
    for (let i = 0; i < records.length; i += 2) {
        const pair = records.slice(i, i + 2)
        requireGate(
            pair.length === 2 &&
                pair[0].id === pair[1].id &&
                pair[0].runtime === pair[1].runtime &&
                pair[0].pairId === pair[1].pairId,
            "MEMORY-ORDER",
            "another lane ran between paired arms",
        )
        same(
            pair.map(r => r.arm),
            manifest.stages.A.timingOrder[Number(pair[0].pairId) % 2],
            "MEMORY-ORDER",
            "wrong arm order",
        )
    }
    const environments = json(evidencePath(root, "memory/environments.json"))
    exactRows(
        environments.map(e => e.id + "/" + e.runtime),
        manifest.memoryScenarios.flatMap(s =>
            s.runtimes.map(runtime => s.id + "/" + runtime),
        ),
        "MEMORY-ENVIRONMENT",
    )
    for (const lane of environments) {
        strictKeys(lane, ["id", "runtime", "pairs"], "MEMORY-ENVIRONMENT")
        requireGate(
            lane.pairs.length === 5,
            "MEMORY-ENVIRONMENT",
            "missing memory pair",
        )
        for (let pair = 0; pair < 5; pair++) {
            const observation = lane.pairs[pair]
            strictKeys(
                observation,
                ["pairId", "before", "after"],
                "MEMORY-ENVIRONMENT",
            )
            requireGate(
                observation.pairId === String(pair),
                "MEMORY-ENVIRONMENT",
                "missing ordinal",
            )
            requireStableEnvironment(observation.before, observation.after)
            const pairRows = records.filter(
                r =>
                    r.id === lane.id &&
                    r.runtime === lane.runtime &&
                    r.pairId === String(pair),
            )
            requireGate(
                pairRows.length === 2,
                "MEMORY-PAIRS",
                "incomplete pair",
            )
            const first = json(evidencePath(root, pairRows[0].process)),
                last = json(evidencePath(root, pairRows[1].process))
            requireGate(
                Date.parse(observation.before.at) <=
                    Date.parse(first.startedAt) &&
                    Date.parse(observation.after.at) >=
                        Date.parse(last.endedAt),
                "MEMORY-ENVIRONMENT",
                "observations do not bracket pair",
            )
        }
    }
}
