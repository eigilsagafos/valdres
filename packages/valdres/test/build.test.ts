import { afterAll, describe, expect, test } from "bun:test"
import {
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
import {
    buildOptions,
    developmentBuildOptions,
    removeStaleBuildJavaScript,
} from "../build"

const temporaryDirectories: string[] = []

const temporaryDirectory = async (prefix: string): Promise<string> => {
    const directory = await mkdtemp(join(tmpdir(), prefix))
    temporaryDirectories.push(directory)
    return directory
}

const run = (
    command: string[],
    cwd: string,
): { exitCode: number; stdout: string; stderr: string } => {
    const result = Bun.spawnSync(command, {
        cwd,
        stdout: "pipe",
        stderr: "pipe",
    })
    return {
        exitCode: result.exitCode,
        stdout: result.stdout.toString(),
        stderr: result.stderr.toString(),
    }
}

let builtDistPromise: Promise<string> | undefined
const builtDist = (): Promise<string> =>
    (builtDistPromise ??= (async () => {
        const outdir = await temporaryDirectory("valdres-v1-dist-")
        // Match the production build's sequencing. Bun 1.4 can share resolver
        // state between simultaneous split builds and intermittently report
        // existing relative modules as missing.
        const results = [
            await Bun.build({ ...buildOptions, outdir }),
            await Bun.build({
                ...developmentBuildOptions,
                outdir: join(outdir, "development"),
            }),
        ]
        for (const result of results) {
            expect(result.success, result.logs.join("\n")).toBe(true)
        }
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
                "InvalidAtomComparatorResultError",
                "InvalidCollectionKeyError",
                "InvalidSynchronousAtomValueError",
                "InvalidSynchronousCollectionValueError",
                "InvalidTransactionCallbackResultError",
                "InvalidTransactionTargetError",
                "MissingCollectionRowError",
                "RuntimeMismatchError",
                "ScopeNotFoundError",
                "SelectorCapabilityError",
                "SelectorCircularDependencyError",
                "StoreDisposedError",
                "StoreTreeMismatchError",
                "SubscriberNotificationError",
                "TransactionClosedError",
                "TransactionPhaseError",
                "UndefinedCollectionValueError",
                "atom",
                "collection",
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

        const output = await Bun.build({
            ...buildOptions,
            outdir: join(packageDirectory, "dist"),
        })
        expect(output.success, output.logs.join("\n")).toBe(true)
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
