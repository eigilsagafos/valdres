// Deterministic validator-protocol fixture, never a control/candidate report.
// The tiny installed files are hash fixtures, not a selector implementation.
// Full artifact-backed cache proofs separately use the fresh F7 control bundle.
import {
    mkdirSync,
    writeFileSync,
    openSync,
    writeSync,
    closeSync,
    linkSync,
} from "node:fs"
import { join } from "node:path"
import { createHash } from "node:crypto"
import { labeledDAGs, closure } from "./graph-oracle.mjs"
import {
    ROOT,
    DIRECTORY,
    manifest,
    checkInputs,
    fileHash,
    sha256,
} from "../../../../scripts/selector-kernel-tournament/inputs.mjs"
import { command } from "../../../../scripts/selector-kernel-tournament/artifact.mjs"
import { hashTree } from "../performance/core-load/artifact.mjs"

export function semanticCacheFixture(root) {
    const directory = join(root, "semantic")
    mkdirSync(directory)
    const raw = join(directory, "bun-0.ndjson")
    const fd = openSync(raw, "wx")
    const digest = createHash("sha256")
    let graphs = 0,
        attempts = 0
    try {
        for (let n = 1; n <= 5; n++) {
            for (const graph of labeledDAGs(n)) {
                const reachable = closure(graph)
                const row = { id: "C-GRAPH-001", n, graph, attempts: [] }
                for (let parent = 0; parent < n; parent++) {
                    for (let dependency = 0; dependency < n; dependency++) {
                        const cycle =
                            parent === dependency ||
                            reachable[dependency][parent]
                        const pathTo = (from, target) => {
                            if (from === target) return [from]
                            for (const next of graph[from]) {
                                const suffix = pathTo(next, target)
                                if (suffix) return [from, ...suffix]
                            }
                            return null
                        }
                        const accepted = graph.map((edges, i) =>
                            i === parent ? [...edges, dependency] : edges,
                        )
                        const value = i =>
                            1 +
                            accepted[i].reduce(
                                (sum, child) => sum + value(child),
                                0,
                            )
                        row.attempts.push({
                            parent,
                            dependency,
                            cycle,
                            exportedCycleError: cycle ? true : null,
                            afterSetupReads: Array(n).fill(null),
                            afterSet: null,
                            value: cycle ? null : value(parent),
                            blame: cycle ? parent : null,
                            path: cycle
                                ? [...pathTo(dependency, parent), dependency]
                                : null,
                            installed: null,
                        })
                        attempts++
                    }
                }
                const line = JSON.stringify(row)
                digest.update(line)
                writeSync(fd, line + "\n")
                graphs++
            }
        }
        const rows = manifest.semanticCases
            .filter(c => c.requiredAt.includes("C"))
            .map(c => {
                const trace =
                    c.id === "C-GRAPH-001"
                        ? [
                              {
                                  name: "exhaustive",
                                  value: {
                                      graphs,
                                      attempts,
                                      rawSha256: digest.digest("hex"),
                                  },
                              },
                          ]
                        : []
                return {
                    id: c.id,
                    status: "pass",
                    trace,
                    traceSha256: sha256(JSON.stringify(trace)),
                    common: {},
                    mode: "public",
                }
            })
        for (const row of rows) writeSync(fd, JSON.stringify(row) + "\n")
        closeSync(fd)
        const worker = join(directory, "semantic-worker.mjs")
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
        )
        let identity
        const processRows = []
        for (const runtime of ["bun", "node"]) {
            const installed = name =>
                join(directory, name + "-" + runtime, "node_modules/valdres")
            const consumer = installed("consumer"),
                foreign = installed("foreign")
            for (const packageRoot of [consumer, foreign]) {
                mkdirSync(join(packageRoot, "dist"), { recursive: true })
                writeFileSync(
                    join(packageRoot, "package.json"),
                    '{"name":"validator-hash-fixture","type":"module"}\n',
                )
                writeFileSync(
                    join(packageRoot, "dist/index.js"),
                    "export const fixture = true\n",
                )
            }
            identity ??= {
                gitSha: "1".repeat(40),
                tarballSha256: "2".repeat(64),
                mode: "timed",
                packageManifestSha256: fileHash(join(consumer, "package.json")),
                productionEntrySha256: fileHash(
                    join(consumer, "dist/index.js"),
                ),
                distTreeSha256: hashTree(join(consumer, "dist")),
            }
            for (let repeat = 0; repeat < 2; repeat++) {
                const stem = `${runtime}-${repeat}`
                const rawPath = join(directory, stem + ".ndjson")
                if (rawPath !== raw) linkSync(raw, rawPath)
                const process = {
                    argv: [
                        runtime,
                        worker,
                        consumer,
                        foreign,
                        join(ROOT, DIRECTORY, "fixture-manifest.v3.json"),
                        rawPath,
                        "C",
                        rows.map(r => r.id).join(","),
                    ],
                    cwd: ROOT,
                    environment: { NODE_ENV: "production", FORCE_COLOR: "0" },
                    pid: 7,
                    startedAt: "2026-09-05T00:00:00.000Z",
                    endedAt: "2026-09-05T00:00:01.000Z",
                    status: 0,
                    signal: null,
                    error: null,
                    stderr: "",
                    stdout: JSON.stringify({
                        schemaVersion: 3,
                        kind: "semantic-process",
                        runtime,
                        mode: "public",
                        packageRoot: consumer,
                        pid: 7,
                        rows,
                    }),
                }
                writeFileSync(
                    join(directory, stem + ".process.json"),
                    JSON.stringify(process),
                )
                processRows.push({
                    runtime,
                    repeat,
                    mode: "public",
                    rows,
                    process: stem + ".process.json",
                    raw: stem + ".ndjson",
                    rawSha256: fileHash(rawPath),
                })
            }
        }
        writeFileSync(
            join(directory, "semantics.json"),
            JSON.stringify({
                schemaVersion: 3,
                kind: "semantic-evidence",
                stage: "C",
                inputs: checkInputs(),
                artifact: identity,
                workerSha256: fileHash(worker),
                processRows,
            }),
        )
        return {
            identity,
            relative: "semantic/semantics.json",
            raw,
            worker,
            process: join(directory, "bun-0.process.json"),
            installedEntry: join(
                directory,
                "consumer-bun/node_modules/valdres/dist/index.js",
            ),
        }
    } catch (error) {
        try {
            closeSync(fd)
        } catch {}
        throw error
    }
}
