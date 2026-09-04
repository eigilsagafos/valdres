import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { pathToFileURL } from "node:url"
const [packageRoot, manifestPath, id, wrapperPath, mutation] =
    process.argv.slice(2)
assert.ok(
    mutation === undefined || mutation === "retain-node",
    "MEMORY-MUTATION: unknown mutation",
)
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")),
    row = manifest.memoryScenarios.find(r => r.id === id)
assert.ok(row, "MEMORY-ID: unknown scenario")
const api = await import(pathToFileURL(packageRoot + "/dist/index.js"))
assert.equal(
    globalThis[Symbol.for("VALDRES_TOURNAMENT_COUNTER_ARTIFACT_V2")],
    undefined,
    "ARTIFACT-INSTRUMENTATION: scored memory requires production artifact",
)
const { makeMemoryFactory, settleMemory, readMemoryHeap } = await import(
    pathToFileURL(wrapperPath)
)
const create = makeMemoryFactory(id, api)
// Allocate recording slots before the initial drain, so taking later readings
// does not itself grow an array or retain the just-released scenario.
const samples = Array.from({ length: 3 }, () => ({
    before: 0.5,
    retainedHeap: 0.5,
    releasedHeaps: Array(3).fill(0.5),
}))
const leakKey = Symbol.for("valdres.tournament.memory-red-retention")
if (mutation) globalThis[leakKey] = null
for (let index = 0; index < 3; index++) {
    const sample = samples[index]
    if (mutation) globalThis[leakKey] = null
    await settleMemory()
    sample.before = Math.round(readMemoryHeap())
    let scenario = create()
    assert.equal(
        scenario.units,
        row.units,
        "MEMORY-UNITS: frozen unit count changed",
    )
    if (mutation) {
        const payload = Array(262144).fill(index + 1)
        globalThis[leakKey] = api.selector(() => payload)
    }
    await settleMemory()
    scenario.verify?.()
    sample.retainedHeap = Math.round(readMemoryHeap())
    scenario.release()
    scenario = undefined
    for (let drain = 0; drain < 3; drain++) {
        await settleMemory()
        sample.releasedHeaps[drain] = Math.round(readMemoryHeap())
    }
}
console.log(
    JSON.stringify({
        schemaVersion: 2,
        kind: "memory-process",
        id,
        runtime: typeof Bun === "undefined" ? "node" : "bun",
        pid: process.pid,
        unitCount: row.units,
        samples,
    }),
)
