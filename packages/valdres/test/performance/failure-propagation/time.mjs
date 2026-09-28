// Uninstrumented timing of healthy, failing and recovering writes. Loads
// several builds into one process and interleaves them round by round,
// alternating their order, so machine noise hits every lane alike.
//
//   bun  time.mjs <topology> <width> <layers> <rounds> <label>=<distDir>... [jotai]
//   node time.mjs ...
//
// Prints one JSON line with per-step p10/p50/p90 in milliseconds; on Node,
// also the mean V8 garbage collections and GC milliseconds per failing write.
import { pathToFileURL } from "node:url"
import { resolve } from "node:path"
import { buildGraph, buildJotaiGraph, readAll, readStacks } from "./graph.mjs"

const [topology, width, layers, roundsArg, ...lanes] = process.argv.slice(2)
if (lanes.length === 0) {
    throw new Error(
        "usage: time.mjs <topology> <width> <layers> <rounds> <label>=<distDir>... [jotai]",
    )
}
const rounds = Number(roundsArg)
const opts = { topology, width: Number(width), layers: Number(layers) }
const runtime = globalThis.Bun
    ? `bun ${Bun.version}`
    : `node ${process.version}`

const graphs = []
for (const lane of lanes) {
    if (lane === "jotai") {
        graphs.push({
            label: lane,
            graph: buildJotaiGraph(await import("jotai/vanilla"), opts),
        })
        continue
    }
    const [label, dir] = lane.split("=")
    const valdres = await import(pathToFileURL(resolve(dir, "index.js")).href)
    graphs.push({ label, graph: buildGraph(valdres, opts) })
}

let GCProfiler
if (!globalThis.Bun) ({ GCProfiler } = await import("node:v8"))

const STEPS = [
    "healthyWrite",
    "healthyRead",
    "failWrite",
    "failRead",
    "failInspect",
    "failInputWrite",
    "failStacks",
    "recoverWrite",
    "recoverRead",
]
const now = () => performance.now()
let sink = 0

const cycle = (graph, gc) => {
    const times = {}
    const step = (name, run) => {
        const start = now()
        sink ^= run() | 0
        times[name] = now() - start
    }
    step("healthyWrite", () =>
        graph.store.set(graph.tick, graph.store.get(graph.tick) + 1),
    )
    step("healthyRead", () => readAll(graph).signature)
    let profiler
    if (GCProfiler) {
        profiler = new GCProfiler()
        profiler.start()
    }
    step("failWrite", () => graph.store.set(graph.fail, true))
    if (profiler) {
        const { statistics } = profiler.stop()
        gc.count += statistics.length
        gc.ms +=
            statistics.reduce((total, event) => total + event.cost, 0) / 1000
        gc.writes++
    }
    step("failRead", () => readAll(graph).signature)
    step("failInspect", () => readAll(graph, true).signature)
    // A relevant input change while the fault persists: fresh wrappers, then
    // a consumer that reads every wrapper's stack.
    step("failInputWrite", () =>
        graph.store.set(graph.tick, graph.store.get(graph.tick) + 1),
    )
    step("failStacks", () => readStacks(graph))
    step("recoverWrite", () => graph.store.set(graph.fail, false))
    step("recoverRead", () => readAll(graph).signature)
    return times
}

for (const lane of graphs) {
    readAll(lane.graph)
    lane.samples = Object.fromEntries(STEPS.map(step => [step, []]))
    lane.gc = { count: 0, ms: 0, writes: 0 }
}
const warmup = Math.max(5, Math.floor(rounds / 5))
for (let round = 0; round < warmup + rounds; round++) {
    const order = round % 2 === 0 ? graphs : [...graphs].reverse()
    for (const lane of order) {
        const gc = round < warmup ? { count: 0, ms: 0, writes: 0 } : lane.gc
        const times = cycle(lane.graph, gc)
        if (round < warmup) continue
        for (const step of STEPS) lane.samples[step].push(times[step])
    }
}

const quantile = (values, p) => {
    const sorted = [...values].sort((a, b) => a - b)
    return sorted[
        Math.min(sorted.length - 1, Math.round(p * (sorted.length - 1)))
    ]
}
const round3 = value => Math.round(value * 1000) / 1000
const rows = graphs.map(lane => {
    const row = { label: lane.label }
    for (const step of STEPS) {
        row[step] = {
            p10: round3(quantile(lane.samples[step], 0.1)),
            p50: round3(quantile(lane.samples[step], 0.5)),
            p90: round3(quantile(lane.samples[step], 0.9)),
        }
    }
    if (lane.gc.writes > 0) {
        row.failWriteGcCount = round3(lane.gc.count / lane.gc.writes)
        row.failWriteGcMs = round3(lane.gc.ms / lane.gc.writes)
    }
    return row
})
console.log(JSON.stringify({ runtime, ...opts, rounds, rows, sink: sink & 1 }))
