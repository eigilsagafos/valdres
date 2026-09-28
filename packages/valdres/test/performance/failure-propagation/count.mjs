// Instrumented structural counts for one build. NOT a timing run: it
// intercepts Object.freeze, Object.preventExtensions and
// Error.prepareStackTrace for the duration of each write, restoring them in
// `finally`.
//
//   bun  count.mjs <distDir> [topology] [width] [layers] [subs]
//   node count.mjs <distDir> [topology] [width] [layers] [subs]
//
// Prints one JSON line per phase.
import { pathToFileURL } from "node:url"
import { resolve } from "node:path"
import { buildGraph, isLibraryWrapper, readAll } from "./graph.mjs"

const [
    distDir,
    topology = "chain",
    width = "100",
    layers = "20",
    subs = "all",
] = process.argv.slice(2)
if (!distDir)
    throw new Error(
        "usage: count.mjs <distDir> [topology] [width] [layers] [subs]",
    )
const valdres = await import(pathToFileURL(resolve(distDir, "index.js")).href)
const opts = { topology, width: Number(width), layers: Number(layers), subs }
const graph = buildGraph(valdres, opts)
const runtime = globalThis.Bun
    ? `bun ${Bun.version}`
    : `node ${process.version}`

// Heap after a full collection: what the published outcomes retain.
let retainedHeap
if (globalThis.Bun) {
    const { heapSize } = await import("bun:jsc")
    retainedHeap = () => {
        Bun.gc(true)
        return heapSize()
    }
} else {
    const { setFlagsFromString } = await import("node:v8")
    const { runInNewContext } = await import("node:vm")
    setFlagsFromString("--expose-gc")
    const gc = runInNewContext("gc")
    retainedHeap = () => {
        gc()
        gc()
        return process.memoryUsage().heapUsed
    }
}

const realFreeze = Object.freeze
const realPreventExtensions = Object.preventExtensions
const realPrepare = Error.prepareStackTrace

const phase = (label, write) => {
    const sealed = { frozen: 0, preventExtensions: 0 }
    let materialized = 0
    const before = { ...graph.counters, notifications: graph.notifications }
    Object.freeze = value => {
        if (isLibraryWrapper(value)) sealed.frozen++
        return realFreeze(value)
    }
    Object.preventExtensions = value => {
        if (isLibraryWrapper(value)) sealed.preventExtensions++
        return realPreventExtensions(value)
    }
    // JavaScriptCore calls this when it materializes a stack (freezing does);
    // V8 calls it on the first `.stack` read, never during these writes.
    Error.prepareStackTrace = (error, frames) => {
        if (isLibraryWrapper(error)) materialized++
        return realPrepare ? realPrepare(error, frames) : String(error)
    }
    let threw = null
    try {
        write()
    } catch (error) {
        threw = error?.code ?? String(error)
    } finally {
        Object.freeze = realFreeze
        Object.preventExtensions = realPreventExtensions
        Error.prepareStackTrace = realPrepare
    }
    const after = { ...graph.counters, notifications: graph.notifications }
    const read = readAll(graph, true)
    const reachable = new Set()
    const roots = new Set()
    let sampleFrames = null
    for (const node of graph.subscribed) {
        try {
            graph.store.get(node)
        } catch (error) {
            let cursor = error
            for (; isLibraryWrapper(cursor); cursor = cursor.cause)
                reachable.add(cursor)
            roots.add(cursor)
            if (sampleFrames === null && isLibraryWrapper(error)) {
                sampleFrames = String(error.stack).split("\n    at ").length - 1
            }
        }
    }
    console.log(
        JSON.stringify({
            runtime,
            distDir,
            phase: label,
            ...opts,
            subscribed: graph.subscribed.length,
            writeThrew: threw,
            ...Object.fromEntries(
                Object.keys(after).map(key => [key, after[key] - before[key]]),
            ),
            wrappersSealed: sealed.frozen + sealed.preventExtensions,
            wrappersFrozen: sealed.frozen,
            stackMaterializationsDuringWrite: materialized,
            errorOutcomes: read.errors,
            reachableWrappers: reachable.size,
            distinctRootIdentities: roots.size,
            maxLibraryCauseDepth: read.maxDepth,
            sampleWrapperStackFrames: sampleFrames,
            retainedHeapBytes: retainedHeap(),
            signature: read.signature,
        }),
    )
}

readAll(graph)
phase("healthy", () =>
    graph.store.set(graph.tick, graph.store.get(graph.tick) + 1),
)
phase("failing", () => graph.store.set(graph.fail, true))
phase("failing-equal-write", () => graph.store.set(graph.fail, true))
phase("failing-input-change", () =>
    graph.store.set(graph.tick, graph.store.get(graph.tick) + 1),
)
phase("recovery", () => graph.store.set(graph.fail, false))
phase("healthy-after", () =>
    graph.store.set(graph.tick, graph.store.get(graph.tick) + 1),
)
graph.dispose()
