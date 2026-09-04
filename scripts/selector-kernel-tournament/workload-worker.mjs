import { pathToFileURL } from "node:url"
import { readFileSync } from "node:fs"
import { createHash } from "node:crypto"
import assert from "node:assert/strict"
import { runWorkload } from "../../packages/valdres/test/selector-kernel-tournament/workloads.mjs"
const [
    packageRoot,
    manifestPath,
    id,
    mode,
    wrapperPath,
    fixtureRoot,
    expectedPath,
] = process.argv.slice(2)
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"))
const row = manifest.performanceWorkloads.find(row => row.id === id)
assert.ok(row, "WORKLOAD-ID: unknown workload")
const api = await import(pathToFileURL(packageRoot + "/dist/index.js"))
const adapter = await import(
    pathToFileURL(packageRoot + "/dist/adapter-internals/v1.js")
)
const observer =
    globalThis[Symbol.for("VALDRES_TOURNAMENT_COUNTER_ARTIFACT_V2")]
const { makeLegacy, collectHeap } = await import(pathToFileURL(wrapperPath))
const result = await runWorkload({
    api,
    adapter,
    observer,
    entryPath: packageRoot + "/dist/index.js",
    fixtureRoot,
    row,
    mode,
    makeLegacy,
})
if (observer) {
    result.common ??= observer.snapshot().common
    result.common.checksum = result.checksum
    result.common.publicOperations =
        result.counts.publicOperations ??
        [
            "renderReads",
            "notificationReads",
            "subscriptions",
            "timedUnsubscriptions",
            "entityWrites",
            "metaWrites",
        ].reduce((sum, key) => sum + (result.counts[key] ?? 0), 0)
    result.common.retainedHeapBytes = await collectHeap()
}
if (expectedPath) {
    const expectations = JSON.parse(readFileSync(expectedPath, "utf8"))
    const expected = expectations.rows.find(row => row.id === id)
    assert.ok(expected, "WORKLOAD-EXPECTED-ID")
    assert.deepEqual(result.counts, expected.counts, "WORKLOAD-WORK-COUNT")
    assert.equal(result.checksum, expected.checksum, "WORKLOAD-CHECKSUM")
}
const entrySha256 = createHash("sha256")
    .update(readFileSync(packageRoot + "/dist/index.js"))
    .digest("hex")
console.log(
    JSON.stringify({
        schemaVersion: 2,
        kind: "workload-process",
        runtime: typeof Bun === "undefined" ? "node" : "bun",
        pid: process.pid,
        entrySha256,
        ...result,
    }),
)
