import { pathToFileURL } from "node:url"
import { readFileSync, writeSync, openSync, closeSync } from "node:fs"
import { runSemanticCases } from "../../packages/valdres/test/selector-kernel-tournament/semantic-cases.mjs"
const [
    packageRoot,
    foreignRoot,
    manifestPath,
    rawPath,
    stage,
    filter,
    mutation,
] = process.argv.slice(2)
const api = await import(pathToFileURL(packageRoot + "/dist/index.js"))
const adapter = await import(
    pathToFileURL(packageRoot + "/dist/adapter-internals/v1.js")
)
const observer =
    globalThis[Symbol.for("VALDRES_TOURNAMENT_COUNTER_ARTIFACT_V3")]
const foreign = await import(pathToFileURL(foreignRoot + "/dist/index.js"))
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"))
const raw = openSync(rawPath, "wx")
let buffer = ""
const emit = row => {
    buffer += JSON.stringify(row) + "\n"
    if (buffer.length > 1024 * 1024) {
        writeSync(raw, buffer)
        buffer = ""
    }
}
try {
    const only =
        filter === "small"
            ? manifest.semanticCases
                  .map(x => x.id)
                  .filter(id => id !== "C-GRAPH-001")
            : filter
              ? filter.split(",")
              : undefined
    const rows = await runSemanticCases({
        api,
        adapter,
        foreign,
        observer,
        manifest,
        only,
        mutation,
        stage,
        emit,
    })
    console.log(
        JSON.stringify({
            schemaVersion: 3,
            kind: "semantic-process",
            runtime: typeof Bun === "undefined" ? "node" : "bun",
            mode: observer ? "counter" : "public",
            packageRoot,
            pid: process.pid,
            rows,
        }),
    )
} finally {
    if (buffer) writeSync(raw, buffer)
    closeSync(raw)
}
