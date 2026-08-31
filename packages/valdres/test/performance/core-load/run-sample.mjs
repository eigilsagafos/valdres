#!/usr/bin/env node
import { pathToFileURL } from "node:url"
import {
    HARNESS_SCHEMA_VERSION,
    isWithin,
    readFixture,
    resolveAdapter,
    sha256File,
} from "./lib.mjs"
import { inspectPackedPackage } from "./artifact.mjs"
import { INITIAL_VIEW_CORE_SCENARIO } from "./initial-view-core.mjs"
import { runCoreLoadWorkload } from "./workload.mjs"

try {
    const options = parseArguments(process.argv.slice(2))
    const fixture = readFixture(options.fixture)
    const packed = inspectPackedPackage(options.packageRoot)
    const adapterPath = resolveAdapter(options.adapter)
    if (!isWithin(packed.entryPath, packed.packageRoot)) {
        throw new Error("packed implementation entry escaped its package root")
    }
    const adapterModule = await import(pathToFileURL(adapterPath).href)
    if (typeof adapterModule.createBenchmarkAdapter !== "function") {
        throw new Error(`${adapterPath}: missing createBenchmarkAdapter()`)
    }
    const adapter = await adapterModule.createBenchmarkAdapter({
        entryPath: packed.entryPath,
        packageRoot: packed.packageRoot,
        mode: options.mode,
    })
    validateAdapter(adapter, options.adapter)
    const result = await runCoreLoadWorkload({
        adapter,
        fixture,
        scenarioName: options.scenario,
        mode: options.mode,
    })
    process.stdout.write(
        `${JSON.stringify({
            schemaVersion: HARNESS_SCHEMA_VERSION,
            kind: "valdres-core-load-sample",
            fixtureId: fixture.id,
            fixtureSha256: sha256File(options.fixture),
            target: {
                role: options.role,
                label: options.label,
                adapter: adapter.id,
                adapterSha256: sha256File(adapterPath),
                packageVersion: packed.packageMetadata.version,
                entrySha256: packed.entrySha256,
                distTreeSha256: packed.distTreeSha256,
            },
            process: {
                pid: process.pid,
                node: process.version,
                v8: process.versions.v8,
            },
            ...result,
        })}\n`,
    )
} catch (error) {
    const message =
        error instanceof Error ? (error.stack ?? error.message) : String(error)
    process.stderr.write(`${message}\n`)
    process.exitCode = 1
}

function parseArguments(args) {
    const values = new Map()
    for (let index = 0; index < args.length; index += 2) {
        const flag = args[index]
        const value = args[index + 1]
        if (
            !flag?.startsWith("--") ||
            value === undefined ||
            value.startsWith("--")
        ) {
            throw new Error(
                `expected --name value pairs, received ${args.join(" ")}`,
            )
        }
        if (values.has(flag)) throw new Error(`duplicate argument ${flag}`)
        values.set(flag, value)
    }
    const allowed = new Set([
        "--package-root",
        "--fixture",
        "--adapter",
        "--scenario",
        "--mode",
        "--role",
        "--label",
    ])
    for (const flag of values.keys()) {
        if (!allowed.has(flag)) throw new Error(`unknown argument ${flag}`)
    }
    for (const flag of allowed) {
        if (!values.has(flag))
            throw new Error(`missing required argument ${flag}`)
    }

    const mode = values.get("--mode")
    if (!new Set(["timed", "oracle", "counters"]).has(mode)) {
        throw new Error(`--mode must be timed, oracle, or counters`)
    }
    const scenario = values.get("--scenario")
    if (
        !new Set(["writes", "no-writes", INITIAL_VIEW_CORE_SCENARIO]).has(
            scenario,
        )
    ) {
        throw new Error(
            `--scenario must be writes, no-writes, or ${INITIAL_VIEW_CORE_SCENARIO}`,
        )
    }
    const role = values.get("--role")
    if (role !== "baseline" && role !== "candidate") {
        throw new Error(`--role must be baseline or candidate`)
    }
    const label = values.get("--label")
    if (label.trim().length === 0 || /[\u0000-\u001f\u007f]/.test(label)) {
        throw new Error(`--label must be a non-empty single-line string`)
    }
    return {
        packageRoot: values.get("--package-root"),
        fixture: values.get("--fixture"),
        adapter: values.get("--adapter"),
        scenario,
        mode,
        role,
        label,
    }
}

function validateAdapter(adapter, expectedId) {
    if (adapter === null || typeof adapter !== "object") {
        throw new Error("adapter factory must return an object")
    }
    if (adapter.id !== expectedId) {
        throw new Error(
            `adapter id ${String(adapter.id)} does not match ${expectedId}`,
        )
    }
    if (adapter.implementationKind !== "packed-valdres-runtime") {
        throw new Error("adapter did not identify a packed Valdres runtime")
    }
    for (const method of [
        "createAtom",
        "createSelector",
        "createStore",
        "createScope",
        "get",
        "update",
        "set",
        "subscribe",
        "dispose",
        "resetWorkCounters",
        "snapshotWorkCounters",
    ]) {
        if (typeof adapter[method] !== "function") {
            throw new Error(`adapter is missing ${method}()`)
        }
    }
}
