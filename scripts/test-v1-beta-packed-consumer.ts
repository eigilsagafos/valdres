import { strict as assert } from "node:assert"
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, join } from "node:path"

const rootDirectory = join(import.meta.dir, "..")
const intendedCoreBetaVersion =
    process.env.VALDRES_PACKED_CORE_BETA_VERSION ?? "1.0.0-beta.26"
const intendedReactBetaVersion =
    process.env.VALDRES_PACKED_REACT_BETA_VERSION ?? "1.0.0-beta.5"
const intendedReactCorePeer =
    process.env.VALDRES_PACKED_REACT_CORE_PEER ?? "^1.0.0-beta.24"
const keepWorkspace = process.env.VALDRES_KEEP_PACKED_SMOKE === "1"

const intendedBetaVersions = {
    valdres: intendedCoreBetaVersion,
    "valdres-react": intendedReactBetaVersion,
} as const

for (const [name, version] of Object.entries(intendedBetaVersions)) {
    if (!/^\d+\.\d+\.\d+-beta\.\d+$/.test(version)) {
        throw new Error(
            `${name} packed beta version must be an x.y.z-beta.N version, received ${version}`,
        )
    }
}

interface CommandResult {
    readonly stdout: string
    readonly stderr: string
}

const run = (
    label: string,
    command: readonly string[],
    cwd: string,
    environment: Readonly<Record<string, string>> = {},
): CommandResult => {
    const result = Bun.spawnSync([...command], {
        cwd,
        env: { ...process.env, ...environment },
        stdout: "pipe",
        stderr: "pipe",
    })
    const stdout = result.stdout.toString()
    const stderr = result.stderr.toString()

    if (result.exitCode !== 0) {
        throw new Error(
            [
                `${label} failed with exit code ${result.exitCode}`,
                `$ ${command.join(" ")}`,
                stdout.trim(),
                stderr.trim(),
            ]
                .filter(Boolean)
                .join("\n"),
        )
    }

    console.log(`\u2713 ${label}`)
    return { stdout, stderr }
}

const writeJson = (path: string, value: unknown): Promise<void> =>
    writeFile(path, `${JSON.stringify(value, null, 4)}\n`)

const requireFile = async (path: string, label: string): Promise<void> => {
    const file = Bun.file(path)
    assert.equal(await file.exists(), true, `${label} is missing: ${path}`)
    assert.ok(file.size > 0, `${label} is empty: ${path}`)
}

const coreProbe = String.raw`
import { strict as assert } from "node:assert"
import * as core from "valdres"
import * as adapter from "valdres/adapter-internals/v1"
import * as foreignCore from "valdres-copy"
import * as foreignAdapter from "valdres-copy/adapter-internals/v1"

assert.deepEqual(Object.keys(adapter).sort(), [
    "assertStore",
    "read",
    "readHydrationSnapshot",
    "subscribe",
])

const count = core.atom(2)
const doubled = core.selector(get => get(count) * 2)
const target = core.store()
adapter.assertStore(target)
assert.equal(adapter.read(target, doubled), 4)
assert.equal(adapter.readHydrationSnapshot(target, doubled), 4)

let notifications = 0
const unsubscribe = adapter.subscribe(target, doubled, () => notifications++)
const { get, set, update, reset, txn } = target
set(count, 3)
assert.equal(get(doubled), 6)
assert.equal(notifications, 1)
update(count, current => current + 2)
assert.equal(txn(transaction => transaction.get(doubled)), 10)
assert.equal(notifications, 2)
reset(count)
assert.equal(get(count), 2)
assert.equal(notifications, 3)
unsubscribe()
unsubscribe()
set(count, 8)
assert.equal(notifications, 3)

const functionValue = core.atom(() => "initial")
let functionCalls = 0
const replacement = () => {
    functionCalls++
    return "replacement"
}
target.set(functionValue, replacement)
assert.equal(target.get(functionValue), replacement)
assert.equal(functionCalls, 0)
target.update(functionValue, previous => () => previous() + "-updated")
assert.equal(functionCalls, 0)
assert.equal(target.get(functionValue)(), "replacement-updated")
assert.equal(functionCalls, 1)

const isRuntimeMismatch = error =>
    error?.name === "RuntimeMismatchError" &&
    error?.code === "VALDRES_RUNTIME_MISMATCH"

const foreignStore = foreignCore.store()
const foreignCount = foreignCore.atom(1)
assert.throws(() => foreignAdapter.assertStore(target), isRuntimeMismatch)
assert.throws(() => adapter.assertStore(foreignStore), isRuntimeMismatch)
assert.throws(() => target.get(foreignCount), isRuntimeMismatch)
assert.throws(() => foreignStore.get(count), isRuntimeMismatch)

foreignAdapter.assertStore(foreignStore)
assert.equal(foreignAdapter.read(foreignStore, foreignCount), 1)

console.log(JSON.stringify({
    runtime: typeof Bun === "undefined" ? "node" : "bun",
    sharedRootAdapterDomain: true,
    crossCopyRejected: true,
}))
`

const reactProbe = String.raw`
import { strict as assert } from "node:assert"
import { createRequire } from "node:module"
import { GlobalRegistrator } from "@happy-dom/global-registrator"
import { atom, selector, store } from "valdres"

// Observe useSyncExternalStore's real subscription cleanup without replacing
// either packed package. Patching the shared CommonJS React object before the
// first ESM import means valdres-react receives this transparent wrapper.
const require = createRequire(import.meta.url)
const React = require("react")
const originalUseSyncExternalStore = React.useSyncExternalStore
let activeExternalSubscriptions = 0
let externalSubscriptionCleanups = 0
const observedSubscriptions = new WeakMap()
React.useSyncExternalStore = (subscribe, getSnapshot, getServerSnapshot) => {
    let observedSubscribe = observedSubscriptions.get(subscribe)
    if (observedSubscribe === undefined) {
        observedSubscribe = notify => {
            activeExternalSubscriptions++
            const unsubscribe = subscribe(notify)
            let cleaned = false
            return () => {
                if (!cleaned) {
                    cleaned = true
                    activeExternalSubscriptions--
                    externalSubscriptionCleanups++
                }
                unsubscribe()
            }
        }
        observedSubscriptions.set(subscribe, observedSubscribe)
    }
    return originalUseSyncExternalStore(
        observedSubscribe,
        getSnapshot,
        getServerSnapshot,
    )
}

const [{ act, createElement }, { renderToString }, { create }, reactApi] =
    await Promise.all([
        import("react"),
        import("react-dom/server"),
        import("react-test-renderer"),
        import("valdres-react"),
    ])

globalThis.IS_REACT_ACT_ENVIRONMENT = true
assert.equal(React.version.startsWith(process.env.EXPECTED_REACT_MAJOR + "."), true)
assert.deepEqual(Object.keys(reactApi).sort(), [
    "Provider",
    "useAtom",
    "useResetAtom",
    "useSetAtom",
    "useStore",
    "useUpdateAtom",
    "useValue",
])

const {
    Provider,
    useAtom,
    useResetAtom,
    useSetAtom,
    useStore,
    useUpdateAtom,
    useValue,
} = reactApi

const count = atom(1)
const functionValue = atom(() => "initial")
const doubled = selector(get => get(count) * 2)
const rootStore = store()
const childStore = rootStore.scope("packed-react-child")
const observed = {
    store: undefined,
    count: undefined,
    doubled: undefined,
    setCount: undefined,
    setFunction: undefined,
    updateFunction: undefined,
    resetCount: undefined,
    renders: 0,
}

function Probe() {
    const selectedStore = useStore()
    const [currentCount, setCount] = useAtom(count)
    const currentDoubled = useValue(doubled)
    const setFunction = useSetAtom(functionValue)
    const updateFunction = useUpdateAtom(functionValue)
    const resetCount = useResetAtom(count)
    Object.assign(observed, {
        store: selectedStore,
        count: currentCount,
        doubled: currentDoubled,
        setCount,
        setFunction,
        updateFunction,
        resetCount,
        renders: observed.renders + 1,
    })
    return createElement("output", null, currentCount + ":" + currentDoubled)
}

let renderer
await act(async () => {
    renderer = create(
        createElement(
            Provider,
            { store: rootStore },
            createElement(
                Provider,
                { store: childStore },
                createElement(Probe),
            ),
        ),
    )
})
assert.equal(observed.store, childStore)
assert.equal(observed.count, 1)
assert.equal(observed.doubled, 2)
assert.equal(activeExternalSubscriptions, 2)

await act(async () => rootStore.set(count, 2))
assert.equal(observed.count, 2)
assert.equal(observed.doubled, 4)

await act(async () => observed.setCount(5))
assert.equal(rootStore.get(count), 2)
assert.equal(childStore.get(count), 5)
assert.equal(observed.doubled, 10)

let replacementCalls = 0
const replacement = () => {
    replacementCalls++
    return "replacement"
}
await act(async () => observed.setFunction(replacement))
assert.equal(childStore.get(functionValue), replacement)
assert.equal(replacementCalls, 0)

let updaterCalls = 0
await act(async () =>
    observed.updateFunction(previous => {
        updaterCalls++
        assert.equal(previous, replacement)
        return () => previous() + "-updated"
    }),
)
assert.equal(updaterCalls, 1)
assert.equal(replacementCalls, 0)
assert.equal(childStore.get(functionValue)(), "replacement-updated")
assert.equal(replacementCalls, 1)

await act(async () => observed.resetCount())
assert.equal(childStore.get(count), 2)
assert.equal(observed.count, 2)

await act(async () => renderer.unmount())
assert.equal(activeExternalSubscriptions, 0)
assert.equal(externalSubscriptionCleanups, 2)
const rendersAfterUnmount = observed.renders
rootStore.set(count, 7)
await Promise.resolve()
assert.equal(observed.renders, rendersAfterUnmount)
assert.equal(childStore.get(count), 7)

const serverCount = atom(9)
let serverSelectorCalls = 0
const serverValue = selector(get => {
    serverSelectorCalls++
    return get(serverCount)
})
const serverStore = store()
const ServerProbe = () => createElement("strong", null, useValue(serverValue))
const serverTree = createElement(
    Provider,
    { store: serverStore },
    createElement(ServerProbe),
)
const html = renderToString(serverTree)
assert.match(html, />9<\/strong>/)
assert.ok(serverSelectorCalls >= 1)

GlobalRegistrator.register({ url: "https://valdres.test/" })
const container = document.createElement("div")
container.innerHTML = html
document.body.append(container)
const recoverableErrors = []
const { hydrateRoot } = await import("react-dom/client")
let hydratedRoot
await act(async () => {
    hydratedRoot = hydrateRoot(container, serverTree, {
        onRecoverableError: error => recoverableErrors.push(error),
    })
})
assert.equal(container.textContent, "9")
assert.deepEqual(recoverableErrors, [])
assert.equal(activeExternalSubscriptions, 1)

await act(async () => serverStore.set(serverCount, 10))
assert.equal(container.textContent, "10")
await act(async () => hydratedRoot.unmount())
assert.equal(activeExternalSubscriptions, 0)
assert.equal(externalSubscriptionCleanups, 3)
await GlobalRegistrator.unregister()

console.log(JSON.stringify({
    runtime: typeof Bun === "undefined" ? "node" : "bun",
    react: React.version,
    initialRender: true,
    updates: true,
    functionValues: true,
    unmountUnsubscribed: true,
    nestedScope: true,
    ssrHydration: true,
}))
`

const typeProbe = String.raw`
import {
    atom,
    selector,
    store,
    type AtomUpdater,
    type State,
    type Store,
} from "valdres"
import {
    Provider,
    useAtom,
    useResetAtom,
    useSetAtom,
    useStore,
    useUpdateAtom,
    useValue,
} from "valdres-react"

const count = atom(0)
const doubled = selector(get => get(count) * 2)
const target: Store = store()
const state: State<number> = doubled
const update: AtomUpdater<number> = current => current + 1

const value: number = useValue(state, target)
const pair: readonly [number, (value: number) => void] = useAtom(count, target)
const set: (value: number) => void = useSetAtom(count, target)
const apply: (update: AtomUpdater<number>) => void = useUpdateAtom(count, target)
const reset: () => void = useResetAtom(count, target)
const selected: Store = useStore()

apply(update)
void Provider
void value
void pair
void reset
void selected

// @ts-expect-error Selectors are read-only and cannot be passed to Atom setters.
useSetAtom(doubled, target)
// @ts-expect-error Exact setters do not interpret functions as updater syntax.
set(current => current + 1)
`

const bundleEntry = String.raw`
import { atom, store } from "valdres"
import * as reactApi from "valdres-react"

export const bundleSmoke = () => {
    const count = atom(4)
    const target = store()
    target.update(count, current => current + 1)
    return {
        value: target.get(count),
        reactExports: Object.keys(reactApi).sort(),
    }
}
`

const bundleProbe = String.raw`
import { strict as assert } from "node:assert"
import { bundleSmoke } from "./bundle.mjs"

assert.deepEqual(bundleSmoke(), {
    value: 5,
    reactExports: [
        "Provider",
        "useAtom",
        "useResetAtom",
        "useSetAtom",
        "useStore",
        "useUpdateAtom",
        "useValue",
    ],
})
`

interface PackedPackage {
    readonly name: "valdres" | "valdres-react"
    readonly tarball: string
}

interface ReactMatrixEntry {
    readonly major: "18" | "19"
    readonly runtimeVersion: string
    readonly typesVersion: string
}

const reactMatrix: readonly ReactMatrixEntry[] = [
    { major: "18", runtimeVersion: "18.3.1", typesVersion: "18.3.31" },
    { major: "19", runtimeVersion: "19.1.1", typesVersion: "19.2.3" },
]

const workspace = await mkdtemp(join(tmpdir(), "valdres-v1-beta-packed-"))
let passed = false

try {
    const sourceManifests = new Map<string, string>()
    for (const name of ["valdres", "valdres-react"] as const) {
        const manifestPath = join(
            rootDirectory,
            "packages",
            name,
            "package.json",
        )
        const sourceManifest = await readFile(manifestPath, "utf8")
        const parsedManifest = JSON.parse(sourceManifest) as Record<
            string,
            unknown
        >
        assert.equal(
            Object.hasOwn(parsedManifest, "gitHead"),
            false,
            `${name} source manifest must leave gitHead to npm`,
        )
        sourceManifests.set(name, sourceManifest)
    }

    run(
        "build core and React JavaScript",
        ["bun", "run", "build:v1-beta"],
        rootDirectory,
    )
    run(
        "build core and React declarations",
        ["bun", "run", "build:types:v1-beta"],
        rootDirectory,
    )

    const stageDirectory = join(workspace, "stage")
    const artifactDirectory = join(workspace, "artifacts")
    await mkdir(join(stageDirectory, "scripts"), { recursive: true })
    await mkdir(artifactDirectory, { recursive: true })
    await Promise.all(
        ["prepack.ts", "publish-metadata.ts"].map(file =>
            cp(
                join(rootDirectory, "scripts", file),
                join(stageDirectory, "scripts", file),
            ),
        ),
    )

    const packedPackages: PackedPackage[] = []
    for (const name of ["valdres", "valdres-react"] as const) {
        const sourceDirectory = join(rootDirectory, "packages", name)
        const packageDirectory = join(stageDirectory, "packages", name)
        await mkdir(packageDirectory, { recursive: true })
        await cp(
            join(sourceDirectory, "dist"),
            join(packageDirectory, "dist"),
            {
                recursive: true,
            },
        )

        const manifest = JSON.parse(sourceManifests.get(name)!) as Record<
            string,
            unknown
        >
        const intendedBetaVersion = intendedBetaVersions[name]
        manifest.version = intendedBetaVersion
        manifest.gitHead = "0000000000000000000000000000000000000000"
        await writeJson(join(packageDirectory, "package.json"), manifest)

        run(
            `prepack shadow ${name}`,
            ["bun", "run", join(stageDirectory, "scripts", "prepack.ts")],
            packageDirectory,
        )

        const prepackedManifest = JSON.parse(
            await readFile(join(packageDirectory, "package.json"), "utf8"),
        ) as {
            version: string
            gitHead?: unknown
            scripts?: unknown
            devDependencies?: unknown
            sideEffects?: unknown
            peerDependencies?: Record<string, string>
            exports: Record<
                string,
                { types: string; import?: string; default: string }
            >
        }
        assert.equal(prepackedManifest.version, intendedBetaVersion)
        assert.equal(prepackedManifest.gitHead, undefined)
        assert.equal(prepackedManifest.scripts, undefined)
        assert.equal(prepackedManifest.devDependencies, undefined)
        if (name === "valdres") {
            assert.equal(prepackedManifest.sideEffects, false)
        } else {
            assert.equal(
                prepackedManifest.peerDependencies?.valdres,
                intendedReactCorePeer,
            )
        }
        for (const [exportPath, targets] of Object.entries(
            prepackedManifest.exports,
        )) {
            await requireFile(
                join(packageDirectory, targets.types),
                `${name} ${exportPath} declaration export`,
            )
            await requireFile(
                join(packageDirectory, targets.import ?? targets.default),
                `${name} ${exportPath} runtime export`,
            )
        }

        const packed = run(
            `npm pack shadow ${name}`,
            [
                "npm",
                "pack",
                "--ignore-scripts",
                "--json",
                "--pack-destination",
                artifactDirectory,
            ],
            packageDirectory,
            { npm_config_loglevel: "error" },
        )
        const packResult = JSON.parse(packed.stdout) as [
            { filename: string; files: { path: string }[] },
        ]
        assert.equal(packResult.length, 1)
        const packedFiles = new Set(packResult[0].files.map(file => file.path))
        assert.equal(packedFiles.has("dist/index.js"), true)
        assert.equal(packedFiles.has("dist/types/index.d.ts"), true)
        if (name === "valdres") {
            assert.equal(packedFiles.has("dist/adapter-internals/v1.js"), true)
            assert.equal(
                packedFiles.has("dist/types/adapter-internals/v1.d.ts"),
                true,
            )
        }
        packedPackages.push({
            name,
            tarball: join(artifactDirectory, basename(packResult[0].filename)),
        })
    }

    for (const [name, original] of sourceManifests) {
        assert.equal(
            await readFile(
                join(rootDirectory, "packages", name, "package.json"),
                "utf8",
            ),
            original,
            `${name} source manifest changed while shadow-packing`,
        )
    }
    console.log(
        "\u2713 source package manifests remained byte-for-byte unchanged",
    )

    const coreTarball = packedPackages.find(
        pkg => pkg.name === "valdres",
    )!.tarball
    const reactTarball = packedPackages.find(
        pkg => pkg.name === "valdres-react",
    )!.tarball

    for (const react of reactMatrix) {
        const consumerDirectory = join(workspace, `react-${react.major}`)
        await mkdir(consumerDirectory, { recursive: true })
        await writeJson(join(consumerDirectory, "package.json"), {
            name: `valdres-packed-react-${react.major}-probe`,
            private: true,
            type: "module",
        })

        run(
            `install packed packages with React ${react.runtimeVersion}`,
            [
                "npm",
                "install",
                "--ignore-scripts",
                "--no-audit",
                "--no-fund",
                "--no-package-lock",
                coreTarball,
                reactTarball,
                `react@${react.runtimeVersion}`,
                `react-dom@${react.runtimeVersion}`,
                `react-test-renderer@${react.runtimeVersion}`,
                `@types/react@${react.typesVersion}`,
                "@happy-dom/global-registrator@20.0.5",
            ],
            consumerDirectory,
            { npm_config_loglevel: "error" },
        )

        const installedCoreManifest = JSON.parse(
            await readFile(
                join(
                    consumerDirectory,
                    "node_modules",
                    "valdres",
                    "package.json",
                ),
                "utf8",
            ),
        ) as {
            version: string
            sideEffects: unknown
            scripts?: unknown
            devDependencies?: unknown
        }
        const installedReactManifest = JSON.parse(
            await readFile(
                join(
                    consumerDirectory,
                    "node_modules",
                    "valdres-react",
                    "package.json",
                ),
                "utf8",
            ),
        ) as { version: string }
        assert.equal(installedCoreManifest.version, intendedCoreBetaVersion)
        assert.equal(installedReactManifest.version, intendedReactBetaVersion)
        assert.equal(installedCoreManifest.sideEffects, false)
        assert.equal(installedCoreManifest.scripts, undefined)
        assert.equal(installedCoreManifest.devDependencies, undefined)

        const installedCoreDirectory = join(
            consumerDirectory,
            "node_modules",
            "valdres",
        )
        const copiedCoreDirectory = join(
            consumerDirectory,
            "node_modules",
            "valdres-copy",
        )
        await cp(installedCoreDirectory, copiedCoreDirectory, {
            recursive: true,
        })
        const copiedManifestPath = join(copiedCoreDirectory, "package.json")
        const copiedManifest = JSON.parse(
            await readFile(copiedManifestPath, "utf8"),
        ) as Record<string, unknown>
        copiedManifest.name = "valdres-copy"
        await writeJson(copiedManifestPath, copiedManifest)

        await Promise.all([
            writeFile(join(consumerDirectory, "core-probe.mjs"), coreProbe),
            writeFile(join(consumerDirectory, "react-probe.mjs"), reactProbe),
            writeFile(join(consumerDirectory, "types-probe.ts"), typeProbe),
            writeFile(join(consumerDirectory, "bundle-entry.mjs"), bundleEntry),
            writeFile(join(consumerDirectory, "bundle-probe.mjs"), bundleProbe),
            writeJson(join(consumerDirectory, "tsconfig.json"), {
                compilerOptions: {
                    target: "ES2022",
                    lib: ["ES2022", "DOM", "DOM.Iterable"],
                    module: "NodeNext",
                    moduleResolution: "NodeNext",
                    strict: true,
                    noEmit: true,
                    skipLibCheck: false,
                    exactOptionalPropertyTypes: true,
                    types: ["react"],
                },
                include: ["types-probe.ts"],
            }),
        ])

        run(
            `Node core/domain probe (React ${react.major} consumer)`,
            ["node", "core-probe.mjs"],
            consumerDirectory,
        )
        run(
            `Bun core/domain probe (React ${react.major} consumer)`,
            ["bun", "core-probe.mjs"],
            consumerDirectory,
        )
        run(
            `Node React ${react.major} behavior and hydration probe`,
            ["node", "react-probe.mjs"],
            consumerDirectory,
            { EXPECTED_REACT_MAJOR: react.major },
        )
        run(
            `Bun React ${react.major} behavior and hydration probe`,
            ["bun", "react-probe.mjs"],
            consumerDirectory,
            { EXPECTED_REACT_MAJOR: react.major },
        )

        run(
            `TypeScript declarations with React ${react.major}`,
            [
                "node",
                join(rootDirectory, "node_modules", "typescript", "bin", "tsc"),
                "-p",
                "tsconfig.json",
            ],
            consumerDirectory,
        )
        run(
            `esbuild browser bundle with React ${react.major}`,
            [
                "node",
                join(
                    rootDirectory,
                    "node_modules",
                    "esbuild",
                    "bin",
                    "esbuild",
                ),
                "bundle-entry.mjs",
                "--bundle",
                "--platform=browser",
                "--format=esm",
                "--outfile=bundle.mjs",
                "--log-level=warning",
            ],
            consumerDirectory,
        )
        run(
            `execute esbuild output for React ${react.major}`,
            ["node", "bundle-probe.mjs"],
            consumerDirectory,
        )
    }

    passed = true
    console.log(
        `\nPacked valdres@${intendedCoreBetaVersion} + valdres-react@${intendedReactBetaVersion} consumer smoke passed for Node, Bun, TypeScript, esbuild, React 18, and React 19.`,
    )
} finally {
    if (keepWorkspace || !passed) {
        console.log(`Packed smoke workspace retained at ${workspace}`)
    } else {
        await rm(workspace, { recursive: true, force: true })
    }
}
