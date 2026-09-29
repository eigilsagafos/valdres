import { afterAll, describe, expect, test } from "bun:test"
import {
    cp,
    mkdir,
    mkdtemp,
    readdir,
    readFile,
    rm,
    writeFile,
} from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, join, resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { removeStaleBuildJavaScript } from "../build"

const temporaryDirectories: string[] = []

const temporaryDirectory = async (prefix: string): Promise<string> => {
    const directory = await mkdtemp(join(tmpdir(), prefix))
    temporaryDirectories.push(directory)
    return directory
}

const run = (
    command: string[],
    cwd: string,
    env?: Record<string, string>,
): { exitCode: number; stdout: string; stderr: string } => {
    const result = Bun.spawnSync(command, {
        cwd,
        stdout: "pipe",
        stderr: "pipe",
        ...(env === undefined ? {} : { env: { ...process.env, ...env } }),
    })
    return {
        exitCode: result.exitCode,
        stdout: result.stdout.toString(),
        stderr: result.stderr.toString(),
    }
}

// Keep the compiler out of Bun 1.4's test-runner resolver state. Even
// sequential in-process builds can report existing modules as missing.
// The child uses the production options, builds graphs in order, and returns
// every result for mandatory compiler assertions before artifact assertions.
const buildGraphs = (
    graphs: readonly { outdir: string; development?: boolean }[],
): void => {
    const child = run(
        [
            process.execPath,
            "--input-type=module",
            "--eval",
            `
                import { buildOptions, developmentBuildOptions } from ${JSON.stringify(pathToFileURL(resolve(import.meta.dir, "../build.ts")).href)}
                const results = []
                for (const graph of ${JSON.stringify(graphs)}) {
                    const options = graph.development ? developmentBuildOptions : buildOptions
                    const result = await Bun.build({ ...options, outdir: graph.outdir })
                    results.push({ success: result.success, logs: result.logs.map(String) })
                }
                console.log(JSON.stringify(results))
            `,
        ],
        resolve(import.meta.dir, ".."),
    )
    expect(child.exitCode, child.stderr).toBe(0)
    const results: { success: boolean; logs: string[] }[] = JSON.parse(
        child.stdout,
    )
    expect(results).toHaveLength(graphs.length)
    for (const result of results) {
        expect(result.success, result.logs.join("\n")).toBe(true)
    }
}

let builtDistPromise: Promise<string> | undefined
const builtDist = (): Promise<string> =>
    (builtDistPromise ??= (async () => {
        const outdir = await temporaryDirectory("valdres-v1-dist-")
        buildGraphs([
            { outdir },
            { outdir: join(outdir, "development"), development: true },
        ])
        return outdir
    })())

afterAll(async () => {
    await Promise.all(
        temporaryDirectories.map(directory =>
            rm(directory, { recursive: true, force: true }),
        ),
    )
})

describe("v1 build output", () => {
    test("loads the query barrel from both split graphs in Bun and Node", async () => {
        const dist = await builtDist()
        for (const directory of [dist, join(dist, "development")]) {
            const rootUrl = pathToFileURL(join(directory, "index.js")).href
            const queryUrl = pathToFileURL(join(directory, "query.js")).href
            const script = `
                const root = await import(${JSON.stringify(rootUrl)})
                const entry = await import(${JSON.stringify(queryUrl)})
                const entities = root.collection({ indexes: { kind: value => value.kind } })
                const tasks = entry.query(entities, { where: { kind: { eq: "task" } } })
                const target = root.store()
                target.set(entities("one"), { kind: "task" })
                console.log(JSON.stringify({
                    exports: Object.keys(entry),
                    rootHasQuery: Object.hasOwn(root, "query"),
                    keys: target.get(tasks).map(row => row.key),
                }))
                target.dispose()
            `
            for (const runtime of ["bun", "node"]) {
                const result = run(
                    [runtime, "--input-type=module", "--eval", script],
                    import.meta.dir,
                )
                expect(result.exitCode, result.stderr).toBe(0)
                expect(JSON.parse(result.stdout)).toEqual({
                    exports: ["query"],
                    rootHasQuery: false,
                    keys: ["one"],
                })
            }
        }
    })

    test("keeps root, inspect, and adapter on one shared domain without the legacy global guard", async () => {
        const dist = await builtDist()
        const files = await readdir(dist, { recursive: true })
        const JavaScript = await Promise.all(
            files
                .filter(file => file.endsWith(".js"))
                .map(async file => readFile(join(dist, file), "utf8")),
        )
        const defaultJavaScript = await Promise.all(
            files
                .filter(
                    file =>
                        file.endsWith(".js") &&
                        !file.startsWith("development/"),
                )
                .map(async file => readFile(join(dist, file), "utf8")),
        )

        expect(files).toContain("index.js")
        expect(files).toContain("inspect.js")
        expect(files).toContain("equality.js")
        expect(files).toContain("adapter-internals/v1.js")
        expect(
            defaultJavaScript.filter(code =>
                code.includes("valdres.runtime-owner/v1"),
            ),
        ).toHaveLength(1)
        expect(JavaScript.join("\n")).not.toContain("__valdres__")
        expect(JavaScript.join("\n")).not.toContain("valdresGlobal")
        expect(JavaScript.join("\n")).not.toContain("VALDRES_VERSION")
        expect(JavaScript.join("\n")).not.toContain("process.env")
    })

    test("loads root, inspect, equality, and adapter from the built split graph with no ambient writes", async () => {
        const dist = await builtDist()
        const rootUrl = pathToFileURL(join(dist, "index.js")).href
        const inspectUrl = pathToFileURL(join(dist, "inspect.js")).href
        const equalityUrl = pathToFileURL(join(dist, "equality.js")).href
        const adapterUrl = pathToFileURL(
            join(dist, "adapter-internals", "v1.js"),
        ).href
        const script = `
            const before = new Set(Reflect.ownKeys(globalThis))
            const root = await import(${JSON.stringify(rootUrl)})
            const inspect = await import(${JSON.stringify(inspectUrl)})
            const equality = await import(${JSON.stringify(equalityUrl)})
            const adapter = await import(${JSON.stringify(adapterUrl)})
            const count = root.atom(1)
            const target = root.store()
            const inspected = inspect.createInspectableStore()
            adapter.assertStore(target)
            adapter.assertStore(inspected.store)
            target.set(count, 4)
            inspected.store.set(count, 5)
            const addedGlobals = Reflect.ownKeys(globalThis)
                .filter(key => !before.has(key))
                .map(String)
            console.log(JSON.stringify({
                addedGlobals,
                equal: equality.deepEqual(
                    { id: 1, nested: [2, 3] },
                    { id: 1, nested: [2, 3] },
                ),
                value: adapter.read(target, count),
                inspectedValue: adapter.read(inspected.store, count),
                root: Object.keys(root).sort(),
                inspect: Object.keys(inspect).sort(),
                equality: Object.keys(equality).sort(),
                adapter: Object.keys(adapter).sort(),
            }))
        `
        const result = run(
            ["node", "--input-type=module", "--eval", script],
            import.meta.dir,
        )
        expect(result.exitCode, result.stderr).toBe(0)
        expect(JSON.parse(result.stdout)).toMatchObject({
            addedGlobals: [],
            equal: true,
            value: 4,
            inspectedValue: 5,
            root: [
                "CallbackCapabilityError",
                "DormantExternalReadError",
                "ExternalSourceDeliveryLimitError",
                "ExternalSourceNonConvergenceError",
                "ExternalSourceOperationError",
                "InvalidAtomComparatorResultError",
                "InvalidCollectionKeyError",
                "InvalidExternalCleanupError",
                "InvalidSynchronousAtomValueError",
                "InvalidSynchronousCollectionValueError",
                "InvalidSynchronousExternalSnapshotError",
                "InvalidTransactionCallbackResultError",
                "InvalidTransactionTargetError",
                "MissingCollectionRowError",
                "RuntimeMismatchError",
                "ScopeNotFoundError",
                "SelectorCapabilityError",
                "SelectorCircularDependencyError",
                "ServerSnapshotUnavailableError",
                "SettleLimitError",
                "StoreDisposedError",
                "StoreTreeMismatchError",
                "SubscriberNotificationError",
                "TransactionClosedError",
                "TransactionPhaseError",
                "UndefinedCollectionValueError",
                "atom",
                "collection",
                "externalAtom",
                "family",
                "presence",
                "selector",
                "store",
            ],
            inspect: ["createInspectableStore"],
            equality: ["deepEqual"],
            adapter: [
                "assertStore",
                "read",
                "readHydrationSnapshot",
                "subscribe",
            ],
        })
    })

    test("emits a declaration entry for the inspect subpath", async () => {
        const outdir = await temporaryDirectory("valdres-v1-types-")
        const packageDirectory = resolve(import.meta.dir, "..")
        const result = run(
            [
                resolve(import.meta.dir, "../../../node_modules/.bin/tsc"),
                "-p",
                join(packageDirectory, "tsconfig.json"),
                "--outDir",
                outdir,
            ],
            packageDirectory,
        )
        expect(result.exitCode, result.stderr).toBe(0)
        expect(await readFile(join(outdir, "inspect.d.ts"), "utf8")).toContain(
            "createInspectableStore",
        )
    })

    test("works through an installed npm tarball with inspect and every runtime entry sharing identity", async () => {
        const workspace = await temporaryDirectory("valdres-v1-pack-")
        const packageDirectory = join(workspace, "package")
        const consumerDirectory = join(workspace, "consumer")
        await mkdir(packageDirectory)
        await mkdir(consumerDirectory)

        buildGraphs([{ outdir: join(packageDirectory, "dist") }])
        await writeFile(
            join(packageDirectory, "package.json"),
            JSON.stringify({
                name: "valdres-packed-probe",
                version: "1.0.0-beta.0",
                type: "module",
                sideEffects: false,
                files: ["dist"],
                exports: {
                    ".": "./dist/index.js",
                    "./inspect": "./dist/inspect.js",
                    "./equality": "./dist/equality.js",
                    "./adapter-internals/v1": "./dist/adapter-internals/v1.js",
                },
            }),
        )
        const packed = run(
            [
                "npm",
                "pack",
                "--ignore-scripts",
                "--json",
                "--pack-destination",
                workspace,
            ],
            packageDirectory,
        )
        expect(packed.exitCode, packed.stderr).toBe(0)
        const [{ filename }] = JSON.parse(packed.stdout) as [
            { filename: string },
        ]
        await writeFile(
            join(consumerDirectory, "package.json"),
            JSON.stringify({ private: true, type: "module" }),
        )
        const installed = run(
            [
                "npm",
                "install",
                "--ignore-scripts",
                "--no-audit",
                "--no-fund",
                "--no-package-lock",
                join(workspace, basename(filename)),
            ],
            consumerDirectory,
        )
        expect(installed.exitCode, installed.stderr).toBe(0)

        const probe = run(
            [
                "node",
                "--input-type=module",
                "--eval",
                `
                    import { atom, family, selector, store } from "valdres-packed-probe"
                    import { createInspectableStore } from "valdres-packed-probe/inspect"
                    import { deepEqual } from "valdres-packed-probe/equality"
                    import {
                        assertStore,
                        read,
                        readHydrationSnapshot,
                        subscribe,
                    } from "valdres-packed-probe/adapter-internals/v1"
                    const count = atom(2)
                    const counts = family((id) => atom(id.length))
                    const doubled = selector(get => get(count) * 2)
                    const target = store()
                    const inspected = createInspectableStore()
                    assertStore(target)
                    assertStore(inspected.store)
                    const unsubscribe = subscribe(target, count, () => {})
                    unsubscribe()
                    inspected.store.set(count, 3)
                    console.log(JSON.stringify({
                        equal: deepEqual(
                            { id: 1, nested: [2, 3] },
                            { id: 1, nested: [2, 3] },
                        ),
                        live: read(target, doubled),
                        family: read(target, counts("packed")),
                        hydration: readHydrationSnapshot(target, doubled),
                        inspected: read(inspected.store, doubled),
                    }))
                `,
            ],
            consumerDirectory,
        )
        expect(probe.exitCode, probe.stderr).toBe(0)
        expect(JSON.parse(probe.stdout)).toEqual({
            equal: true,
            live: 4,
            family: 6,
            hydration: 4,
            inspected: 6,
        })
    })

    test("removes stale split chunks without deleting type output", async () => {
        const outdir = await temporaryDirectory("valdres-v1-build-")
        await mkdir(join(outdir, "adapter-internals"))
        await Promise.all([
            writeFile(join(outdir, "index.js"), "old index"),
            writeFile(join(outdir, "inspect.js"), "old inspect"),
            writeFile(join(outdir, "equality.js"), "old equality"),
            writeFile(join(outdir, "chunk-old.js"), "old chunk"),
            writeFile(join(outdir, "chunk-old.js.map"), "old map"),
            writeFile(
                join(outdir, "adapter-internals", "v1.js"),
                "old adapter",
            ),
            writeFile(join(outdir, "index.d.ts"), "export {}"),
        ])

        await removeStaleBuildJavaScript(outdir)

        expect(await readdir(outdir)).toEqual(["index.d.ts"])
    })
})

test("collection-only bundles exclude the separately exported query engine", async () => {
    const { build } = await import("esbuild")
    const packageRoot = resolve(import.meta.dir, "..")
    for (const useQuery of [false, true]) {
        const result = await build({
            stdin: {
                contents: `import { collection } from './src/index.ts';
                    ${useQuery ? "import { query } from './src/query.ts';" : ""}
                    const entities = collection({ indexes: { kind: value => value.kind } });
                    globalThis.entities = entities;
                    ${useQuery ? "globalThis.tasks = query(entities, { where: { kind: { eq: 'task' } } });" : ""}`,
                resolveDir: packageRoot,
                loader: "ts",
            },
            bundle: true,
            write: false,
            format: "esm",
            metafile: true,
        })
        const modules = Object.values(result.metafile!.outputs).flatMap(
            output => Object.keys(output.inputs),
        )
        expect(modules.some(path => path.endsWith("collection-query.ts"))).toBe(
            useQuery,
        )
        expect(
            result.outputFiles[0]!.text.includes(
                "query requires one equality term",
            ),
        ).toBe(useQuery)
    }
})

// Each case runs in a fresh process because it reconfigures the global Error.
// Four roots throw an Error, a string, a plain object and a forged wrapper;
// each fails a selector chain, and a fallback reader catches the first chain's
// dependency error.
const STACK_PROBE = String.raw`
const valdres = await import(process.env.VALDRES_ROOT_URL)
const testCase = process.env.VALDRES_STACK_CASE
const describeLimit = () => {
    const descriptor = Object.getOwnPropertyDescriptor(Error, "stackTraceLimit")
    return descriptor === undefined
        ? null
        : { ...descriptor, get: descriptor.get?.name, set: descriptor.set?.name }
}
const access = { gets: 0, sets: 0 }
const prepared = []
if (testCase === "limit-7") Error.stackTraceLimit = 7
if (testCase === "limit-missing") delete Error.stackTraceLimit
if (testCase === "limit-readonly") {
    Object.defineProperty(Error, "stackTraceLimit", {
        value: 4,
        writable: false,
        enumerable: true,
        configurable: true,
    })
}
if (testCase === "limit-accessor") {
    Object.defineProperty(Error, "stackTraceLimit", {
        get: function limitGet() {
            access.gets++
            return 6
        },
        set: function limitSet() {
            access.sets++
        },
        enumerable: true,
        configurable: true,
    })
}
if (testCase === "prepare-stack-trace") {
    Error.prepareStackTrace = (error, frames) => {
        prepared.push(error.name)
        return "custom " + error.name + " " + frames.length
    }
}
const limitBefore = describeLimit()
// A value that looks like a wrapper (its prototype and code) without being
// constructed by Valdres.
const sample = valdres.selector(() => {
    throw 0
})
let wrapperPrototype
try {
    valdres.store().get(sample)
} catch (error) {
    wrapperPrototype = Object.getPrototypeOf(error)
}
const forged = Object.create(wrapperPrototype, {
    code: { value: "VALDRES_SELECTOR_GETTER_ERROR", enumerable: true },
})
const thrown = {
    error: new Error("root failure"),
    primitive: "root failure",
    object: { reason: "root failure" },
    forged,
}
const kinds = Object.keys(thrown)
const fail = valdres.atom(false)
const roots = kinds.map(kind =>
    valdres.selector(get => {
        if (get(fail)) throw thrown[kind]
        return 1
    }),
)
const middles = roots.map(root => valdres.selector(get => get(root) + 1))
const leaves = middles.map(middle => valdres.selector(get => get(middle) + 1))
const caught = []
const fallback = valdres.selector(get => {
    try {
        return get(middles[0])
    } catch (error) {
        caught.push(error)
        return -1
    }
})
const store = valdres.store()
for (const state of [...leaves, fallback]) store.sub(state, () => {})
const preparedBeforeWrite = [...prepared]
store.set(fail, true)
const preparedDuringWrite = prepared.slice(preparedBeforeWrite.length)
const isWrapper = value =>
    value instanceof Error &&
    (value.code === "VALDRES_SELECTOR_GETTER_ERROR" ||
        value.code === "VALDRES_SELECTOR_DEPENDENCY_ERROR")
const thrownValues = new Set(Object.values(thrown))
const chainOf = error => {
    const chain = []
    for (
        let cursor = error;
        isWrapper(cursor) && !thrownValues.has(cursor);
        cursor = cursor.cause
    ) {
        chain.push(cursor)
    }
    return chain
}
const errorOf = state => {
    try {
        store.get(state)
    } catch (error) {
        return error
    }
}
const chains = Object.fromEntries(
    kinds.map((kind, index) => [kind, chainOf(errorOf(leaves[index]))]),
)
chains.fallback = chainOf(caught[0])
const result = {
    limitBefore,
    limitAfter: describeLimit(),
    access,
    preparedBeforeWrite,
    preparedDuringWrite,
    chains: Object.fromEntries(
        Object.entries(chains).map(([kind, chain]) => [
            kind,
            chain.map(wrapper => {
                const stack = wrapper.stack
                return {
                    code: wrapper.code,
                    frames:
                        typeof stack === "string"
                            ? stack.split("\n").filter(line => /^\s+at /.test(line)).length
                            : null,
                    stack: testCase === "prepare-stack-trace" ? stack : undefined,
                }
            }),
        ]),
    ),
    exactCauses: kinds.every(kind => Object.is(chains[kind].at(-1).cause, thrown[kind])),
    fallbackCause: chains.fallback.at(-1).cause === thrown.error,
    fallbackValue: store.get(fallback),
    applicationValuesUntouched:
        JSON.stringify(Reflect.ownKeys(thrown.object)) === '["reason"]' &&
        JSON.stringify(Reflect.ownKeys(thrown.forged)) === '["code"]' &&
        Object.isExtensible(thrown.object) &&
        Object.isExtensible(thrown.error) &&
        thrown.error.message === "root failure",
}
store.set(fail, false)
result.recovered = [...leaves, fallback].map(state => store.get(state))
store.dispose()
console.log(JSON.stringify(result))
`

type StackProbeResult = {
    limitBefore: Record<string, unknown> | null
    limitAfter: Record<string, unknown> | null
    access: { gets: number; sets: number }
    preparedBeforeWrite: string[]
    preparedDuringWrite: string[]
    chains: Record<
        "error" | "primitive" | "object" | "forged" | "fallback",
        { code: string; frames: number | null; stack?: string }[]
    >
    exactCauses: boolean
    fallbackCause: boolean
    fallbackValue: number
    applicationValuesUntouched: boolean
    recovered: number[]
}

const GETTER = "VALDRES_SELECTOR_GETTER_ERROR"
const DEPENDENCY = "VALDRES_SELECTOR_DEPENDENCY_ERROR"
const CAPABILITY = "VALDRES_SELECTOR_CAPABILITY_ERROR"

describe("propagated selector error stacks in the built output", () => {
    const probe = async (
        runtime: "bun" | "node",
        testCase: string,
    ): Promise<StackProbeResult> => {
        const dist = await builtDist()
        const result = run(
            [runtime, "--input-type=module", "--eval", STACK_PROBE],
            import.meta.dir,
            {
                VALDRES_ROOT_URL: pathToFileURL(join(dist, "index.js")).href,
                VALDRES_STACK_CASE: testCase,
            },
        )
        expect(result.exitCode, result.stderr).toBe(0)
        const parsed: StackProbeResult = JSON.parse(result.stdout)
        // Outcomes, causes and recovery never depend on the stack policy.
        for (const kind of [
            "error",
            "primitive",
            "object",
            "forged",
        ] as const) {
            expect(parsed.chains[kind].map(wrapper => wrapper.code)).toEqual([
                GETTER,
                DEPENDENCY,
                GETTER,
                DEPENDENCY,
                GETTER,
            ])
        }
        expect(parsed.chains.fallback.map(wrapper => wrapper.code)).toEqual([
            DEPENDENCY,
            GETTER,
            DEPENDENCY,
            GETTER,
        ])
        expect(parsed.exactCauses).toBe(true)
        expect(parsed.fallbackCause).toBe(true)
        expect(parsed.fallbackValue).toBe(-1)
        expect(parsed.applicationValuesUntouched).toBe(true)
        expect(parsed.recovered).toEqual([3, 3, 3, 3, 2])
        // Error.stackTraceLimit is left exactly as it was, whatever its shape,
        // and never read or written through an accessor.
        expect(parsed.limitAfter).toEqual(parsed.limitBefore)
        expect(parsed.access).toEqual({ gets: 0, sets: 0 })
        return parsed
    }
    const frames = (result: StackProbeResult) =>
        Object.fromEntries(
            Object.entries(result.chains).map(([kind, chain]) => [
                kind,
                chain.map(wrapper => wrapper.frames),
            ]),
        )
    // On V8 only the first wrapper around a failure, the innermost in each
    // chain, records frames; every other wrapper's stack is its header.
    // A thrown value that only looks like a wrapper is treated like any other.
    const originFramesOnly = (count: number) => ({
        error: [0, 0, 0, 0, count],
        primitive: [0, 0, 0, 0, count],
        object: [0, 0, 0, 0, count],
        forged: [0, 0, 0, 0, count],
        fallback: [0, 0, 0, count],
    })

    test("Node keeps frames only where a failure enters the graph and restores the limit exactly", async () => {
        expect(frames(await probe("node", "default"))).toEqual(
            originFramesOnly(10),
        )
        const custom = await probe("node", "limit-7")
        expect(custom.limitAfter).toMatchObject({ value: 7, writable: true })
        expect(frames(custom)).toEqual(originFramesOnly(7))
    })

    test("Node leaves a missing, read-only or accessor Error.stackTraceLimit alone", async () => {
        const missing = await probe("node", "limit-missing")
        expect(missing.limitAfter).toBeNull()
        const readonly = await probe("node", "limit-readonly")
        expect(readonly.limitAfter).toMatchObject({ value: 4, writable: false })
        // Nothing to suspend: every wrapper captures frames as before.
        for (const chain of Object.values(frames(readonly))) {
            expect(chain.every(count => count === 4)).toBe(true)
        }
        const accessor = await probe("node", "limit-accessor")
        expect(accessor.limitAfter).toMatchObject({
            get: "limitGet",
            set: "limitSet",
        })
    })

    test("Node formats wrapper stacks through a custom prepareStackTrace only when read", async () => {
        const result = await probe("node", "prepare-stack-trace")
        expect(result.preparedBeforeWrite).toEqual([])
        expect(result.preparedDuringWrite).toEqual([])
        expect(result.chains.primitive.map(wrapper => wrapper.stack)).toEqual([
            "custom SelectorGetterError 0",
            "custom SelectorDependencyError 0",
            "custom SelectorGetterError 0",
            "custom SelectorDependencyError 0",
            "custom SelectorGetterError 10",
        ])
    })

    test("Bun keeps every wrapper's frames and computes them only when read", async () => {
        for (const testCase of [
            "default",
            "limit-readonly",
            "limit-accessor",
        ]) {
            for (const chain of Object.values(
                frames(await probe("bun", testCase)),
            )) {
                expect(chain.every(count => count !== null && count > 0)).toBe(
                    true,
                )
            }
        }
        expect((await probe("bun", "limit-missing")).limitAfter).toBeNull()
        const result = await probe("bun", "prepare-stack-trace")
        // No stack is computed while failing, not even to detect the engine.
        expect(result.preparedBeforeWrite).toEqual([])
        expect(result.preparedDuringWrite).toEqual([])
        for (const chain of Object.values(result.chains)) {
            for (const wrapper of chain) {
                expect(wrapper.stack).toMatch(
                    /^custom Selector(Getter|Dependency)Error [1-9]\d*$/,
                )
            }
        }
    })
})

// Each case runs in a fresh process, so the first failure below is the first
// one the runtime's engine detection ever sees. The formatting hook is
// installed after a healthy read and before any failure.
const HOOK_PROBE = String.raw`
const valdres = await import(process.env.VALDRES_ENTRY)
const hookCase = process.env.VALDRES_HOOK_CASE
const sentinel = { marker: "hook failure" }
const rootCause = { marker: "application failure" }
const secondCause = new Error("second failure")
const fail = valdres.atom(false)
const other = valdres.atom(0)
const root = valdres.selector(get => {
    if (get(fail)) throw rootCause
    return 1
})
const leaf = valdres.selector(get => get(root) + 1)
const secondRoot = valdres.selector(() => {
    throw secondCause
})
const secondLeaf = valdres.selector(get => get(secondRoot))
const store = valdres.store()
let notifications = 0
store.sub(leaf, () => notifications++)
const result = { initial: store.get(leaf) }
const attempt = run => {
    try {
        return { value: run() }
    } catch (error) {
        return { threw: error === sentinel ? "hook failure" : (error?.code ?? String(error)), error }
    }
}
let hookCalls = 0
const reentry = []
Error.prepareStackTrace = (error, frames) => {
    hookCalls++
    if (hookCase === "throw-generic" && error.name === "Error") throw sentinel
    if (hookCase === "throw-all") throw sentinel
    if (hookCase === "reentrant") {
        reentry.push(attempt(() => store.get(leaf)), attempt(() => store.set(other, hookCalls)))
    }
    return "custom " + error.name + " " + frames.length
}
const isWrapper = value =>
    value instanceof Error &&
    (value.code === "VALDRES_SELECTOR_GETTER_ERROR" ||
        value.code === "VALDRES_SELECTOR_DEPENDENCY_ERROR")
const outcome = (target, state, cause) => {
    const read = attempt(() => target.get(state))
    if (!("threw" in read)) return { value: read.value }
    const codes = []
    let cursor = read.error
    while (isWrapper(cursor) && cursor !== cause) {
        codes.push(cursor.code)
        cursor = cursor.cause
    }
    return { codes, exactCause: cursor === cause, error: read.error }
}
const summary = ({ error, ...rest }) => rest
const failures = {}
if (process.env.VALDRES_FIRST === "read") {
    failures.coldRead = outcome(store, secondLeaf, secondCause)
}
const write = attempt(() => store.set(fail, true))
result.write = "threw" in write ? write.threw : "returned"
result.notificationsAfterWrite = notifications
failures.leaf = outcome(store, leaf, rootCause)
failures.leafAgain = outcome(store, leaf, rootCause)
result.sameLeafError = failures.leafAgain.error === failures.leaf.error
failures.coldRead ??= outcome(store, secondLeaf, secondCause)
failures.coldReadAgain = outcome(store, secondLeaf, secondCause)
const otherStore = valdres.store()
otherStore.set(fail, true)
failures.otherStore = outcome(otherStore, leaf, rootCause)
result.hookCallsDuringFailures = hookCalls
result.leafExtensible = Object.isExtensible(failures.leaf.error)
if (hookCase === "reentrant") {
    // Outside any selector callback, a formatting hook may use the Store.
    result.stack = failures.leaf.error.stack
    result.reentry = reentry.map(({ value, threw, error }) => ({
        value,
        threw,
        sameLeafError: error === failures.leaf.error,
    }))
    result.otherAfterReentry = store.get(other)
}
store.set(fail, false)
result.recovered = store.get(leaf)
result.notificationsAfterRecovery = notifications
result.failures = Object.fromEntries(
    Object.entries(failures).map(([key, value]) => [key, summary(value)]),
)
console.log(JSON.stringify(result))
`

type HookProbeFailure = { codes: string[]; exactCause: boolean }
type HookProbeResult = {
    initial: number
    write: string
    notificationsAfterWrite: number
    sameLeafError: boolean
    hookCallsDuringFailures: number
    leafExtensible: boolean
    stack?: string
    reentry?: { value?: unknown; threw?: string; sameLeafError: boolean }[]
    otherAfterReentry?: number
    recovered: number
    notificationsAfterRecovery: number
    failures: Record<
        "coldRead" | "coldReadAgain" | "leaf" | "leafAgain" | "otherStore",
        HookProbeFailure
    >
}

let installedConsumerPromise: Promise<string> | undefined
const installedConsumer = (): Promise<string> =>
    (installedConsumerPromise ??= (async () => {
        const workspace = await temporaryDirectory("valdres-v1-hooks-")
        const packageDirectory = join(workspace, "package")
        const consumerDirectory = join(workspace, "consumer")
        await mkdir(consumerDirectory, { recursive: true })
        await cp(await builtDist(), join(packageDirectory, "dist"), {
            recursive: true,
        })
        await writeFile(
            join(packageDirectory, "package.json"),
            JSON.stringify({
                name: "valdres-hook-probe",
                version: "1.0.0-beta.0",
                type: "module",
                sideEffects: false,
                files: ["dist"],
                exports: { ".": "./dist/index.js" },
            }),
        )
        const packed = run(
            [
                "npm",
                "pack",
                "--ignore-scripts",
                "--json",
                "--pack-destination",
                workspace,
            ],
            packageDirectory,
        )
        expect(packed.exitCode, packed.stderr).toBe(0)
        const [{ filename }] = JSON.parse(packed.stdout) as [
            { filename: string },
        ]
        await writeFile(
            join(consumerDirectory, "package.json"),
            JSON.stringify({ private: true, type: "module" }),
        )
        const installed = run(
            [
                "npm",
                "install",
                "--ignore-scripts",
                "--no-audit",
                "--no-fund",
                "--no-package-lock",
                join(workspace, basename(filename)),
            ],
            consumerDirectory,
        )
        expect(installed.exitCode, installed.stderr).toBe(0)
        return consumerDirectory
    })())

// Forces engine detection to fail: reading an Error's stack descriptor throws.
const FAILED_DETECTION_PROBE = String.raw`
const valdres = await import(process.env.VALDRES_ENTRY)
const describeLimit = () => JSON.stringify(Object.getOwnPropertyDescriptor(Error, "stackTraceLimit"))
const limitBefore = describeLimit()
const native = Object.getOwnPropertyDescriptor
let stackQueries = 0
Object.getOwnPropertyDescriptor = function (target, key) {
    if (key === "stack" && target instanceof Error) {
        stackQueries++
        throw new Error("detection unavailable")
    }
    return Reflect.apply(native, this, arguments)
}
const rootCause = { marker: "application failure" }
const fail = valdres.atom(false)
const root = valdres.selector(get => {
    if (get(fail)) throw rootCause
    return 1
})
const leaf = valdres.selector(get => get(root) + 1)
const store = valdres.store()
let notifications = 0
store.sub(leaf, () => notifications++)
const errorOf = (target, state) => {
    try {
        target.get(state)
    } catch (error) {
        return error
    }
}
const chainOf = error => {
    const chain = []
    for (let cursor = error; cursor instanceof Error && cursor !== rootCause; cursor = cursor.cause) {
        chain.push(cursor)
    }
    return { chain, exactCause: chain.at(-1)?.cause === rootCause }
}
store.set(fail, true)
const leafError = errorOf(store, leaf)
const first = chainOf(leafError)
const again = errorOf(store, leaf) === leafError
const otherStore = valdres.store()
otherStore.set(fail, true)
const other = chainOf(errorOf(otherStore, leaf))
Object.getOwnPropertyDescriptor = native
const frames = wrapper => String(wrapper.stack).split("\n").filter(line => /^\s+at /.test(line)).length
const result = {
    stackQueries,
    codes: first.chain.map(wrapper => wrapper.code),
    exactCause: first.exactCause && other.exactCause,
    sameOnRepeat: again,
    frozen: first.chain.map(wrapper => Object.isFrozen(wrapper)),
    extensible: first.chain.map(wrapper => Object.isExtensible(wrapper)),
    framed: first.chain.map(wrapper => frames(wrapper) > 0),
    limitUnchanged: describeLimit() === limitBefore,
    notifications,
}
store.set(fail, false)
result.recovered = store.get(leaf)
result.notificationsAfterRecovery = notifications
console.log(JSON.stringify(result))
`

// Where the fresh-process probes load Valdres from: the TypeScript source
// (Bun), the built output and an npm-installed tarball (Bun and Node).
const probeTargets = async () => [
    {
        label: "source",
        runtimes: ["bun"],
        cwd: import.meta.dir,
        entry: pathToFileURL(resolve(import.meta.dir, "../src/index.ts")).href,
    },
    {
        label: "built",
        runtimes: ["bun", "node"],
        cwd: import.meta.dir,
        entry: pathToFileURL(join(await builtDist(), "index.js")).href,
    },
    {
        label: "installed",
        runtimes: ["bun", "node"],
        cwd: await installedConsumer(),
        entry: "valdres-hook-probe",
    },
]

describe("engine detection with an application formatting hook", () => {
    const probeAll = async (hookCase: string, first: "write" | "read") => {
        const results: (HookProbeResult & { where: string })[] = []
        for (const target of await probeTargets()) {
            for (const runtime of target.runtimes) {
                const result = run(
                    [runtime, "--input-type=module", "--eval", HOOK_PROBE],
                    target.cwd,
                    {
                        VALDRES_ENTRY: target.entry,
                        VALDRES_HOOK_CASE: hookCase,
                        VALDRES_FIRST: first,
                    },
                )
                const where = `${target.label} ${runtime} ${hookCase} ${first}`
                expect(result.exitCode, `${where}\n${result.stderr}`).toBe(0)
                results.push({ where, ...JSON.parse(result.stdout) })
            }
        }
        return results
    }
    // What every target must report: the application's failures, unchanged
    // outcomes and recovery, and no formatting hook call while failing.
    const observed = (result: HookProbeResult & { where: string }) => ({
        where: result.where,
        initial: result.initial,
        write: result.write,
        notificationsAfterWrite: result.notificationsAfterWrite,
        failures: result.failures,
        sameLeafError: result.sameLeafError,
        leafExtensible: result.leafExtensible,
        hookCallsDuringFailures: result.hookCallsDuringFailures,
        recovered: result.recovered,
        notificationsAfterRecovery: result.notificationsAfterRecovery,
    })
    const chain = { codes: [GETTER, DEPENDENCY, GETTER], exactCause: true }
    const expected = (where: string) => ({
        where,
        initial: 2,
        write: "returned",
        notificationsAfterWrite: 1,
        failures: {
            coldRead: chain,
            coldReadAgain: chain,
            leaf: chain,
            leafAgain: chain,
            otherStore: chain,
        },
        sameLeafError: true,
        leafExtensible: false,
        hookCallsDuringFailures: 0,
        recovered: 2,
        notificationsAfterRecovery: 2,
    })

    for (const first of ["write", "read"] as const) {
        for (const hookCase of ["throw-generic", "throw-all"]) {
            test(`a hook that throws (${hookCase}) cannot replace the first failure (${first} first)`, async () => {
                const results = await probeAll(hookCase, first)
                expect(results).toHaveLength(5)
                expect(results.map(observed)).toEqual(
                    results.map(result => expected(result.where)),
                )
            })
        }
    }

    test("a re-entrant hook runs only when a stack is read, outside selector callbacks", async () => {
        const results = await probeAll("reentrant", "write")
        expect(results).toHaveLength(5)
        expect(
            results.map(result => ({
                ...observed(result),
                stack: result.stack?.startsWith("custom SelectorGetterError "),
                reentry: result.reentry,
                otherAfterReentry: result.otherAfterReentry,
            })),
        ).toEqual(
            results.map(result => ({
                ...expected(result.where),
                stack: true,
                reentry: [
                    { threw: GETTER, sameLeafError: true },
                    { sameLeafError: false },
                ],
                otherAfterReentry: 1,
            })),
        )
    })

    test("a failed engine probe falls back to main's frozen, framed wrappers and is not retried", async () => {
        for (const target of await probeTargets()) {
            for (const runtime of target.runtimes) {
                const result = run(
                    [
                        runtime,
                        "--input-type=module",
                        "--eval",
                        FAILED_DETECTION_PROBE,
                    ],
                    target.cwd,
                    { VALDRES_ENTRY: target.entry },
                )
                const where = `${target.label} ${runtime}`
                expect(result.exitCode, `${where}\n${result.stderr}`).toBe(0)
                expect({ where, ...JSON.parse(result.stdout) }).toEqual({
                    where,
                    // One failed probe, on every engine, and no retry.
                    stackQueries: 1,
                    codes: [GETTER, DEPENDENCY, GETTER],
                    exactCause: true,
                    sameOnRepeat: true,
                    frozen: [true, true, true],
                    extensible: [false, false, false],
                    framed: [true, true, true],
                    limitUnchanged: true,
                    notifications: 1,
                    recovered: 2,
                    notificationsAfterRecovery: 2,
                })
            }
        }
    })
})

// Accessors an application may install before the first selector failure:
// a global Bun accessor or polyfill, or a setter on Error.prototype.name that
// tampers with Error.stackTraceLimit, throws or re-enters the Store.
const ACCESSOR_PROBE = String.raw`
const testCase = process.env.VALDRES_CASE
const sentinel = { marker: "accessor failure" }
const calls = { bun: 0, name: 0 }
const reentry = []
let store
let side
const reenter = () => {
    try {
        store.set(side, store.get(side) + 1)
        return "wrote"
    } catch (error) {
        return error?.code ?? "threw"
    }
}
if (testCase === "bun-throwing") {
    Object.defineProperty(globalThis, "Bun", {
        configurable: true,
        get() {
            calls.bun++
            throw sentinel
        },
    })
}
if (testCase === "bun-reentrant") {
    Object.defineProperty(globalThis, "Bun", {
        configurable: true,
        get() {
            calls.bun++
            reentry.push(reenter())
        },
    })
}
if (testCase === "bun-polyfill") globalThis.Bun = { version: "polyfill" }
if (testCase === "bun-polyfill-fixed-limit") {
    globalThis.Bun = { version: "polyfill" }
    Object.defineProperty(Error, "stackTraceLimit", { writable: false })
}
if (testCase === "bun-polyfill-locked") {
    Object.defineProperty(globalThis, "Bun", { value: {}, enumerable: true })
}
const valdres = await import(process.env.VALDRES_ENTRY)
const limitBefore = Object.getOwnPropertyDescriptor(Error, "stackTraceLimit")
const rootCause = { marker: "application failure" }
const secondCause = new Error("second failure")
const fail = valdres.atom(false)
side = valdres.atom(0)
const root = valdres.selector(get => {
    if (get(fail)) throw rootCause
    return 1
})
const leaf = valdres.selector(get => get(root) + 1)
const secondRoot = valdres.selector(() => {
    throw secondCause
})
const secondLeaf = valdres.selector(get => get(secondRoot))
store = valdres.store()
let notifications = 0
store.sub(leaf, () => notifications++)
const initial = store.get(leaf)
if (testCase.startsWith("name-")) {
    Object.defineProperty(Error.prototype, "name", {
        configurable: true,
        get() {
            return "Error"
        },
        set(name) {
            Object.defineProperty(this, "name", {
                value: name,
                writable: true,
                enumerable: true,
                configurable: true,
            })
            calls.name++
            if (testCase === "name-readonly") {
                Object.defineProperty(Error, "stackTraceLimit", { writable: false })
            }
            if (testCase === "name-throw-at-zero" && Error.stackTraceLimit === 0) {
                throw sentinel
            }
            if (testCase === "name-throw") throw sentinel
            if (testCase === "name-delete") delete Error.stackTraceLimit
            if (testCase === "name-accessor") {
                Object.defineProperty(Error, "stackTraceLimit", {
                    configurable: true,
                    get: () => 10,
                    set() {
                        throw sentinel
                    },
                })
            }
            if (testCase === "name-reentrant") reentry.push(reenter())
            if (testCase === "name-observe") reentry.push(Error.stackTraceLimit)
        },
    })
}
const isWrapper = value =>
    value instanceof Error &&
    (value.code === "VALDRES_SELECTOR_GETTER_ERROR" ||
        value.code === "VALDRES_SELECTOR_DEPENDENCY_ERROR")
const outcome = (target, state, cause) => {
    let error
    try {
        return { value: target.get(state) }
    } catch (caught) {
        error = caught
    }
    const chain = []
    let cursor = error
    while (isWrapper(cursor) && cursor !== cause) {
        chain.push(cursor)
        cursor = cursor.cause
    }
    return { chain, exactCause: cursor === cause, error }
}
let write = "returned"
try {
    store.set(fail, true)
} catch (error) {
    write = error === sentinel ? "accessor failure" : (error?.code ?? String(error))
}
const leafFailure = outcome(store, leaf, rootCause)
const failures = {
    leaf: leafFailure,
    leafAgain: outcome(store, leaf, rootCause),
    coldRead: outcome(store, secondLeaf, secondCause),
    coldReadAgain: outcome(store, secondLeaf, secondCause),
}
const otherStore = valdres.store()
otherStore.set(fail, true)
failures.otherStore = outcome(otherStore, leaf, rootCause)
const limitAfter = Object.getOwnPropertyDescriptor(Error, "stackTraceLimit")
const sameDescriptor = (a, b) =>
    a === b ||
    (a !== undefined &&
        b !== undefined &&
        ["value", "writable", "get", "set", "enumerable", "configurable"].every(
            key => Object.is(a[key], b[key]),
        ))
const frames = wrapper =>
    String(wrapper.stack)
        .split("\n")
        .filter(line => /^\s+at /.test(line)).length
const chain = leafFailure.chain ?? []
const result = {
    calls,
    reentry,
    initial,
    write,
    notificationsAfterWrite: notifications,
    failures: Object.fromEntries(
        Object.entries(failures).map(([key, { chain, exactCause }]) => [
            key,
            { codes: (chain ?? []).map(wrapper => wrapper.code), exactCause },
        ]),
    ),
    sameLeafError: failures.leafAgain.error === leafFailure.error,
    limitUnchanged: sameDescriptor(limitBefore, limitAfter),
    frozen: chain.map(wrapper => Object.isFrozen(wrapper)),
    extensible: chain.map(wrapper => Object.isExtensible(wrapper)),
}
if (testCase.startsWith("name-")) {
    delete Error.prototype.name
    Object.defineProperty(Error.prototype, "name", {
        value: "Error",
        writable: true,
        configurable: true,
    })
}
if (limitAfter !== undefined && "value" in limitAfter) {
    result.frames = chain.map(wrapper => frames(wrapper) > 0)
}
store.set(fail, false)
result.recovered = store.get(leaf)
result.notificationsAfterRecovery = notifications
result.side = store.get(side)
console.log(JSON.stringify(result))
`

describe("detection and wrapper construction run no application accessor", () => {
    const chain = { codes: [GETTER, DEPENDENCY, GETTER], exactCause: true }
    const probeCase = async (testCase: string, runtimes = ["bun", "node"]) => {
        const results = []
        for (const target of await probeTargets()) {
            for (const runtime of target.runtimes) {
                if (!runtimes.includes(runtime)) continue
                const result = run(
                    [runtime, "--input-type=module", "--eval", ACCESSOR_PROBE],
                    target.cwd,
                    { VALDRES_ENTRY: target.entry, VALDRES_CASE: testCase },
                )
                const where = `${target.label} ${runtime} ${testCase}`
                expect(result.exitCode, `${where}\n${result.stderr}`).toBe(0)
                results.push({ where, runtime, ...JSON.parse(result.stdout) })
            }
        }
        return results
    }
    // Outcomes, causes, notifications, recovery and the stack-limit descriptor
    // match an environment without the accessor; engine policy is unchanged.
    const expected = (where: string, runtime: string) => {
        const v8 = runtime === "node"
        return {
            where,
            runtime,
            calls: { bun: 0, name: 0 },
            reentry: [],
            initial: 2,
            write: "returned",
            notificationsAfterWrite: 1,
            failures: {
                leaf: chain,
                leafAgain: chain,
                coldRead: chain,
                coldReadAgain: chain,
                otherStore: chain,
            },
            sameLeafError: true,
            limitUnchanged: true,
            frozen: [v8, v8, v8],
            extensible: [false, false, false],
            // V8 keeps frames only on the first wrapper around the thrown value.
            frames: v8 ? [false, false, true] : [true, true, true],
            recovered: 2,
            notificationsAfterRecovery: 2,
            side: 0,
        }
    }

    for (const testCase of [
        "bun-throwing",
        "bun-reentrant",
        "bun-polyfill",
        "bun-polyfill-locked",
    ]) {
        // Bun's own global is non-configurable, so these run where it is absent.
        test(`a global Bun that is not Bun's own (${testCase}) is never read and changes nothing`, async () => {
            const results = await probeCase(testCase, ["node"])
            expect(results).toHaveLength(2)
            expect(results).toEqual(
                results.map(result => expected(result.where, result.runtime)),
            )
        })
    }

    test("without a writable stack limit to probe with, a polyfilled Bun keeps main's wrappers", async () => {
        const results = await probeCase("bun-polyfill-fixed-limit", ["node"])
        expect(results).toHaveLength(2)
        expect(results).toEqual(
            results.map(result => ({
                ...expected(result.where, result.runtime),
                frozen: [true, true, true],
                frames: [true, true, true],
            })),
        )
    })

    for (const testCase of [
        "name-readonly",
        "name-throw-at-zero",
        "name-throw",
        "name-delete",
        "name-accessor",
        "name-reentrant",
        "name-observe",
    ]) {
        test(`an Error.prototype.name setter (${testCase}) never runs for wrappers`, async () => {
            const results = await probeCase(testCase)
            expect(results).toHaveLength(5)
            expect(results).toEqual(
                results.map(result => expected(result.where, result.runtime)),
            )
        })
    }

    test("a JavaScriptCore realm without Bun's global builds wrappers as main does", () => {
        // Built for and run in a node:vm realm of Bun, which has no Bun global.
        // Detection formats no stack, so the hook runs only for the wrappers
        // main also freezes. As on main, that happens inside the selector
        // callback, where re-entrant Store writes stay rejected.
        const script = String.raw`
            import { runInNewContext } from "node:vm"
            const build = await Bun.build({
                entrypoints: [${JSON.stringify(resolve(import.meta.dir, "../src/index.ts"))}],
                format: "cjs",
                target: "browser",
                packages: "bundle",
            })
            if (!build.success) throw new Error(build.logs.join("\n"))
            const code = await build.outputs[0].text()
            const probe = ${"`"}(() => {
                const v = module.exports
                const cause = { id: "cause" }
                const fail = v.atom(false)
                const side = v.atom(0)
                const store = v.store()
                const root = v.selector(get => { if (get(fail)) throw cause; return 1 })
                const leaf = v.selector(get => get(root) + 1)
                let notifications = 0
                store.sub(leaf, () => notifications++)
                const calls = []
                Error.prepareStackTrace = (error, frames) => {
                    try {
                        store.set(side, 1)
                        calls.push(error.name + " wrote")
                    } catch (e) {
                        calls.push(error.name + " " + e.code)
                    }
                    return error.name
                }
                store.set(fail, true)
                let found
                try { store.get(leaf) } catch (e) { found = e }
                let again
                try { store.get(leaf) } catch (e) { again = e }
                let cursor = found
                const codes = []
                while (cursor && cursor.code) { codes.push(cursor.code); cursor = cursor.cause }
                const result = {
                    hasBun: Object.getOwnPropertyDescriptor(globalThis, "Bun") !== undefined,
                    calls, codes, exactCause: cursor === cause,
                    sameError: found === again, frozen: Object.isFrozen(found),
                    notifications, side: store.get(side),
                }
                store.set(fail, false)
                result.recovered = store.get(leaf)
                return JSON.stringify(result)
            })()${"`"}
            console.log(runInNewContext(code + "\n" + probe, { module: { exports: {} } }))
        `
        const result = run(
            ["bun", "--input-type=module", "--eval", script],
            import.meta.dir,
        )
        expect(result.exitCode, result.stderr).toBe(0)
        expect(JSON.parse(result.stdout)).toEqual({
            hasBun: false,
            // As on main: each wrapper is formatted as it is frozen, inside the
            // selector callback, and a write from the hook is rejected.
            calls: [
                `SelectorGetterError ${CAPABILITY}`,
                `SelectorDependencyError ${CAPABILITY}`,
                `SelectorGetterError ${CAPABILITY}`,
            ],
            codes: [GETTER, DEPENDENCY, GETTER],
            exactCause: true,
            sameError: true,
            frozen: true,
            notifications: 1,
            side: 0,
            recovered: 2,
        })
    })
})
