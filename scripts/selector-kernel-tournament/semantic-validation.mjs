import { recordedRoot } from "./recorded-root.mjs"
import { assertInstalledArtifact } from "./artifact.mjs"
import { readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { createHash } from "node:crypto"
import {
    ROOT,
    DIRECTORY,
    manifest,
    json,
    requireGate,
    fileHash,
    sha256,
    exactRows,
    checkInputs,
} from "./inputs.mjs"
import { evidencePath, strictKeys, same, canonical } from "./evidence.mjs"
import {
    labeledDAGs,
    insertionClosesCycle,
    assertDAG,
    validateCyclePath,
    validateGraphRejection,
} from "../../packages/valdres/test/selector-kernel-tournament/graph-oracle.mjs"
import { verifyCompiledWorker } from "./runner-validation.mjs"
import { validateProcess } from "./process-evidence.mjs"
export function validateSemanticRaw(path, mode, stage = "A") {
    const fuzz = new Map()
    let graphs = 0,
        attempts = 0,
        hash = createHash("sha256")
    const generator = (function* () {
        for (let n = 1; n <= 5; n++)
            for (const graph of labeledDAGs(n)) yield { n, graph }
    })()
    const summaries = new Map()
    for (const line of readFileSync(path, "utf8").trimEnd().split("\n")) {
        const row = JSON.parse(line)
        requireGate(
            manifest.semanticCases.some(c => c.id === row.id),
            "SEMANTIC-ID",
            "unknown raw fixture",
        )
        if (row.id === "C-GRAPH-001" && Array.isArray(row.attempts)) {
            strictKeys(
                row,
                ["id", "n", "graph", "attempts"],
                "SEMANTIC-RAW-SCHEMA",
            )
            const expected = generator.next()
            requireGate(!expected.done, "C-GRAPH-001", "extra graph")
            same(
                { n: row.n, graph: row.graph },
                expected.value,
                "C-GRAPH-001",
                "missing or reordered graph",
            )
            requireGate(
                row.attempts.length === row.n ** 2,
                "C-GRAPH-001",
                "missing attempt",
            )
            for (let p = 0; p < row.n; p++)
                for (let d = 0; d < row.n; d++) {
                    const attempt = row.attempts[p * row.n + d]
                    strictKeys(
                        attempt,
                        [
                            "parent",
                            "dependency",
                            "cycle",
                            "exportedCycleError",
                            "afterSetupReads",
                            "afterSet",
                            "value",
                            "blame",
                            "path",
                            "installed",
                        ],
                        "SEMANTIC-RAW-SCHEMA",
                    )
                    requireGate(
                        attempt.parent === p &&
                            attempt.dependency === d &&
                            attempt.cycle ===
                                insertionClosesCycle(row.graph, p, d),
                        "C-GRAPH-001",
                        "incorrect edge admission",
                    )
                    requireGate(
                        mode === "counter"
                            ? Array.isArray(attempt.installed)
                            : attempt.installed === null,
                        "SEMANTIC-RAW-MODE",
                        "wrong observation artifact",
                    )
                    requireGate(
                        attempt.exportedCycleError ===
                            (attempt.cycle ? true : null) &&
                            Array.isArray(attempt.afterSetupReads) &&
                            attempt.afterSetupReads.length === row.n,
                        "C-GRAPH-001",
                        "exported error identity or operation boundaries missing",
                    )
                    for (const graph of [
                        ...attempt.afterSetupReads,
                        attempt.afterSet,
                    ]) {
                        requireGate(
                            mode === "counter"
                                ? Array.isArray(graph) && graph.length === row.n
                                : graph === null,
                            "C-GRAPH-001",
                            "missing intermediate graph",
                        )
                        if (graph) assertDAG(graph, "C-GRAPH-001")
                    }
                    if (attempt.cycle) {
                        validateGraphRejection(attempt, row.graph, stage)
                    } else {
                        const graph = row.graph.map((edges, i) =>
                            i === p ? [...edges, d] : edges,
                        )
                        const value = i =>
                            1 + graph[i].reduce((sum, j) => sum + value(j), 0)
                        requireGate(
                            attempt.value === value(p) &&
                                attempt.blame === null &&
                                attempt.path === null,
                            "C-GRAPH-001",
                            "wrong acyclic result",
                        )
                        if (attempt.installed) {
                            assertDAG(attempt.installed)
                            same(
                                attempt.installed[p],
                                [...new Set(graph[p])],
                                "C-GRAPH-001",
                                "accepted edge missing",
                            )
                        }
                    }
                    attempts++
                }
            hash.update(JSON.stringify(row))
            graphs++
        } else if (row.status !== undefined) {
            strictKeys(
                row,
                ["id", "status", "trace", "traceSha256", "common", "mode"],
                "SEMANTIC-RAW-SCHEMA",
            )
            requireGate(
                row.status === "pass" &&
                    row.mode === mode &&
                    row.traceSha256 === sha256(JSON.stringify(row.trace)) &&
                    !summaries.has(row.id),
                "SEMANTIC-TRACE",
                "invalid or duplicate trace summary",
            )
            if (row.id === "A-EQUAL-001") {
                same(
                    row.trace.filter(t =>
                        ["comparisons", "notifications"].includes(t.name),
                    ),
                    [
                        {
                            name: "comparisons",
                            value: [
                                [1, 3],
                                [1, 5],
                                [1, 2],
                            ],
                        },
                        { name: "notifications", value: ["error", 1, 2] },
                    ],
                    "A-EQUAL-001",
                    "equality recovery trace differs",
                )
            }
            summaries.set(row.id, row)
        } else {
            strictKeys(
                row,
                ["id", "seed", "repeat", "values"],
                "SEMANTIC-FUZZ-SCHEMA",
            )
            const params = manifest.semanticCases.find(
                c => c.id === "A-FUZZ-001",
            ).parameters
            requireGate(
                row.id === "A-FUZZ-001" &&
                    params.seeds.includes(row.seed) &&
                    [0, 1].includes(row.repeat) &&
                    row.values.length === params.operationsPerSeed,
                "SEMANTIC-FUZZ",
                "incomplete generated trace",
            )
            const key = row.seed + "/" + row.repeat
            requireGate(
                !fuzz.has(key),
                "SEMANTIC-FUZZ",
                "duplicate generated trace",
            )
            fuzz.set(key, sha256(JSON.stringify(row.values)))
        }
    }
    requireGate(
        generator.next().done && graphs === 29853 && attempts === 740951,
        "C-GRAPH-001",
        "incomplete exhaustive evidence",
    )
    exactRows(
        [...summaries.keys()],
        manifest.semanticCases
            .filter(c => c.requiredAt.includes(stage))
            .map(c => c.id),
        "SEMANTIC-INVENTORY",
    )
    const summary = summaries
        .get("C-GRAPH-001")
        .trace.find(t => t.name === "exhaustive").value
    requireGate(
        summary.rawSha256 === hash.digest("hex") &&
            summary.graphs === graphs &&
            summary.attempts === attempts,
        "SEMANTIC-TRACE",
        "exhaustive digest mismatch",
    )
    if (stage === "A") {
        const parameters = manifest.semanticCases.find(
            c => c.id === "A-FUZZ-001",
        ).parameters
        exactRows(
            [...fuzz.keys()],
            parameters.seeds.flatMap(seed =>
                [0, 1].map(repeat => seed + "/" + repeat),
            ),
            "SEMANTIC-FUZZ",
        )
        const expected = parameters.seeds.map(seed => ({
            name: "fuzz",
            value: {
                seed,
                operations: parameters.operationsPerSeed,
                repeatedDigest: fuzz.get(seed + "/0"),
            },
        }))
        same(
            summaries.get("A-FUZZ-001").trace,
            expected,
            "SEMANTIC-FUZZ",
            "fuzz summary mismatch",
        )
        for (const seed of parameters.seeds)
            requireGate(
                fuzz.get(seed + "/0") === fuzz.get(seed + "/1"),
                "SEMANTIC-DETERMINISM",
                "fuzz replay",
            )
    } else
        requireGate(fuzz.size === 0, "SEMANTIC-FUZZ", "A trace in C evidence")
    return summaries
}
export function validateSemanticEvidence(
    root,
    relative,
    identity,
    mode,
    cache = new Map(),
) {
    const path = evidencePath(root, relative)
    const bytes = readFileSync(path)
    // A shared report cache spans arms, modes and recorded invocations. Bind
    // every caller input, including all installed-artifact identity fields.
    const key = canonical({
        root: resolve(root),
        path: resolve(path),
        invocationRoot: root,
        recordedRoot: recordedRoot(),
        evidenceSha256: sha256(bytes),
        identity,
        mode,
    })
    const evidence = JSON.parse(bytes.toString("utf8"))
    strictKeys(
        evidence,
        [
            "schemaVersion",
            "kind",
            "stage",
            "inputs",
            "artifact",
            "workerSha256",
            "processRows",
        ],
        "SEMANTIC-EVIDENCE-SCHEMA",
    )
    requireGate(
        ["public", "counter"].includes(mode) &&
            evidence.schemaVersion === 3 &&
            evidence.kind === "semantic-evidence" &&
            evidence.artifact.gitSha === identity.gitSha &&
            evidence.artifact.tarballSha256 === identity.tarballSha256 &&
            evidence.artifact.mode ===
                (mode === "public" ? "timed" : "counter"),
        "SEMANTIC-EVIDENCE-IDENTITY",
        "wrong semantic build",
    )
    exactRows(
        evidence.processRows.map(r => r.runtime + "/" + r.repeat),
        ["bun/0", "bun/1", "node/0", "node/1"],
        "SEMANTIC-REPEATS",
    )
    requireGate(
        ["C", "A"].includes(evidence.stage),
        "SEMANTIC-STAGE",
        "unknown stage",
    )
    same(
        evidence.inputs,
        checkInputs(),
        "PROVENANCE-INPUT-HASH",
        "semantic inputs differ",
    )
    const worker = join(dirname(relative), "semantic-worker.mjs")
    requireGate(
        fileHash(evidencePath(root, worker)) === evidence.workerSha256,
        "PROVENANCE-WORKER-HASH",
        worker,
    )
    verifyCompiledWorker(
        evidencePath(root, worker),
        "scripts/selector-kernel-tournament/semantic-worker.mjs",
    )
    const results = [],
        rawEvidence = []
    for (const process of evidence.processRows) {
        strictKeys(
            process,
            [
                "runtime",
                "repeat",
                "mode",
                "rows",
                "process",
                "raw",
                "rawSha256",
            ],
            "SEMANTIC-PROCESS-SCHEMA",
        )
        requireGate(
            process.mode === mode,
            "SEMANTIC-RAW-MODE",
            "mixed observation modes",
        )
        const raw = join(dirname(relative), process.raw)
        requireGate(
            fileHash(evidencePath(root, raw)) === process.rawSha256,
            "SEMANTIC-RAW-HASH",
            raw,
        )
        const result = json(
            evidencePath(root, join(dirname(relative), process.process)),
        )
        const consumer = join(
                root,
                dirname(relative),
                "consumer-" + process.runtime,
                "node_modules/valdres",
            ),
            foreign = join(
                root,
                dirname(relative),
                "foreign-" + process.runtime,
                "node_modules/valdres",
            )
        validateProcess(result, {
            argv: [
                process.runtime,
                join(root, worker),
                consumer,
                foreign,
                join(recordedRoot(), DIRECTORY, "fixture-manifest.v3.json"),
                join(root, raw),
                evidence.stage,
                ...(evidence.stage === "C"
                    ? [
                          manifest.semanticCases
                              .filter(r => r.requiredAt.includes("C"))
                              .map(r => r.id)
                              .join(","),
                      ]
                    : []),
            ],
        })
        for (const packageRoot of [consumer, foreign])
            assertInstalledArtifact(packageRoot, identity)
        const stdout = JSON.parse(result.stdout)
        strictKeys(
            stdout,
            [
                "schemaVersion",
                "kind",
                "runtime",
                "mode",
                "packageRoot",
                "pid",
                "rows",
            ],
            "SEMANTIC-STDOUT",
        )
        same(
            { ...stdout, rows: [] },
            {
                schemaVersion: 3,
                kind: "semantic-process",
                runtime: process.runtime,
                mode,
                packageRoot: consumer,
                pid: result.pid,
                rows: [],
            },
            "SEMANTIC-STDOUT",
            "worker identity differs",
        )
        same(
            stdout.rows,
            process.rows,
            "SEMANTIC-TRACE",
            "stdout summary mismatch",
        )
        rawEvidence.push({ path: evidencePath(root, raw), rows: process.rows })
        results.push(process)
    }
    for (const runtime of ["bun", "node"]) {
        const replays = results
            .filter(r => r.runtime === runtime)
            .sort((a, b) => a.repeat - b.repeat)
        same(
            replays[0].rows.map(r => [r.id, r.traceSha256]),
            replays[1].rows.map(r => [r.id, r.traceSha256]),
            "SEMANTIC-DETERMINISM",
            runtime,
        )
    }
    // Never cache filesystem/provenance checks: referenced raw/process/worker
    // bytes, installed chunks, invocation and frozen inputs were revalidated
    // above even on a hit. Only the expensive oracle analysis is reusable.
    if (cache.has(key)) return cache.get(key)
    for (const raw of rawEvidence) {
        const summaries = validateSemanticRaw(raw.path, mode, evidence.stage)
        same(
            [...summaries.values()],
            raw.rows,
            "SEMANTIC-TRACE",
            "summary differs from raw evidence",
        )
    }
    cache.set(key, results)
    return results
}
