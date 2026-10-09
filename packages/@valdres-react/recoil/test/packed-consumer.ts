/**
 * Packed-consumer gate for `@valdres-react/recoil`, against the artifacts.
 *
 * Builds and packs `valdres`, `valdres-react` and this package the way the
 * release does (shadow-staged `dist`, the repository's `scripts/prepack.ts`,
 * `npm pack`), then for React 18.3.1 and 19.1.1 installs them into an isolated
 * consumer and checks:
 *
 * - the differential scenarios against the recorded Recoil 0.7.7 reference;
 * - runtime identity: under the default and the `development` export
 *   conditions, in Node and Bun, the adapter runs on the same Valdres graph as
 *   the application (and the other graph is demonstrably a different runtime);
 * - server rendering and hydration in Node;
 * - the installed declarations, with `skipLibCheck: false`, under `bundler`
 *   and `NodeNext` resolution, including declaration emit;
 * - the tarball contents, peer ranges, and that no source manifest changed.
 *
 * This package stays release-ignored; the gate checks what it would ship.
 *
 *   bun run test:packed            (from packages/@valdres-react/recoil)
 *   KEEP_WORKSPACE=1 bun run test:packed
 */
import { strict as assert } from "node:assert"
import { spawnSync } from "node:child_process"
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, join } from "node:path"
import { pendingReleaseVersions } from "../../../../scripts/lib/pending-release-versions"
import { compareWithOracle } from "./differential/compare"
import { scenarios } from "./differential/scenarios"

const PACKAGE = join(import.meta.dir, "..")
const ROOT = join(PACKAGE, "../../..")
const DIFFERENTIAL = join(import.meta.dir, "differential")

const run = (
    label: string,
    command: readonly string[],
    cwd: string,
    env: Record<string, string> = {},
) => {
    const result = spawnSync(command[0]!, command.slice(1), {
        cwd,
        encoding: "utf8",
        env: { ...process.env, ...env },
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 300_000,
    })
    if (result.status !== 0)
        throw new Error(
            `${label} failed (exit ${result.status})\n${result.stdout}\n${result.stderr}`,
        )
    return result
}

const dirs = {
    valdres: join(ROOT, "packages/valdres"),
    "valdres-react": join(ROOT, "packages/valdres-react"),
    "@valdres-react/recoil": PACKAGE,
} as const
type Name = keyof typeof dirs

const reactMatrix = [
    { major: "18", react: "18.3.1", types: "18.3.31", typesDom: "18.3.7" },
    { major: "19", react: "19.1.1", types: "19.2.3", typesDom: "19.2.3" },
] as const

const IDENTITY_PROBE = `import { strict as assert } from "node:assert"
import { createElement as h } from "react"
import { renderToString } from "react-dom/server"
import * as core from "valdres"
import { useValue } from "valdres-react"
import { RecoilRoot, atom, selector, toValdresState, useRecoilValue } from "@valdres-react/recoil"

const resolved = import.meta.resolve("valdres")
const graph = resolved.includes("/dist/development/") ? "development" : "production"
if (process.env.EXPECT_GRAPH) assert.equal(graph, process.env.EXPECT_GRAPH)

const count = atom({ key: "count", default: 2 })
const doubled = selector({ key: "doubled", get: ({ get }) => get(count) * 2 })
const native = core.atom("native")

// The application's Store reads adapter state: one runtime.
const app = core.store()
assert.equal(app.get(toValdresState(doubled)), 4)
assert.equal(app.get(toValdresState(count)), 2)

// RecoilRoot's Store serves the application's own atoms to valdres-react.
const Read = () => \`\${useRecoilValue(doubled)} \${useValue(native)}\`
assert.equal(
    renderToString(h(RecoilRoot, { initializeState: ({ set }) => set(count, 5) }, h(Read))),
    "10 native",
)

// The other graph is a separate runtime, so the checks above are meaningful.
const other = await import(new URL(graph === "development" ? "../index.js" : "./development/index.js", resolved).href)
assert.throws(() => other.store().get(toValdresState(count)), error => error?.name === "RuntimeMismatchError")
console.log(\`IDENTITY_OK \${graph}\`)
`

const HYDRATION_PROBE = `import { strict as assert } from "node:assert"
import { GlobalRegistrator } from "@happy-dom/global-registrator"
const { createElement: h, act } = await import("react")
const { renderToString } = await import("react-dom/server")
const { atom, selector, RecoilRoot, useRecoilState, useRecoilValue } = await import("@valdres-react/recoil")

const name = atom({ key: "name", default: "default" })
const upper = selector({ key: "upper", get: ({ get }) => get(name).toUpperCase() })
let setName
const Read = () => {
    const [value, set] = useRecoilState(name)
    setName = set
    return h("b", null, value, " ", useRecoilValue(upper))
}
const App = () => h(RecoilRoot, { initializeState: ({ set }) => set(name, "server") }, h(Read))
const html = renderToString(h(App))
assert.equal(html.replaceAll("<!-- -->", ""), "<b>server SERVER</b>")

GlobalRegistrator.register()
globalThis.IS_REACT_ACT_ENVIRONMENT = true
const { hydrateRoot } = await import("react-dom/client")
const container = document.createElement("div")
container.innerHTML = html
document.body.append(container)
const recoverable = []
const errors = []
const consoleError = console.error
console.error = (...args) => errors.push(args.join(" "))
let root
await act(async () => {
    root = hydrateRoot(container, h(App), { onRecoverableError: error => recoverable.push(error) })
})
console.error = consoleError
assert.deepEqual(recoverable, [])
assert.deepEqual(errors, [])
assert.equal(container.textContent, "server SERVER")
await act(async () => setName("client"))
assert.equal(container.textContent, "client CLIENT")
await act(async () => root.unmount())
await GlobalRegistrator.unregister()
console.log("HYDRATION_OK")
`

const TYPES_PROBE = `import type { ReactElement } from "react"
import type { State } from "valdres"
import {
    DefaultValue,
    RecoilRoot,
    UnsupportedRecoilFeatureError,
    atom,
    atomFamily,
    isRecoilValue,
    selector,
    selectorFamily,
    toValdresState,
    useRecoilCallback,
    useRecoilState,
    useRecoilValue,
    useResetRecoilState,
    useSetRecoilState,
    type Loadable,
    type MutableSnapshot,
    type RecoilState,
    type RecoilValue,
    type RecoilValueReadOnly,
    type SetterOrUpdater,
} from "@valdres-react/recoil"

export const count: RecoilState<number> = atom({ key: "count", default: 0 })
export const pending = atom<string>({ key: "pending" })
export const doubled: RecoilValueReadOnly<number> = selector({
    key: "doubled",
    get: ({ get }) => get(count) * 2,
})
export const writable: RecoilState<number> = selector({
    key: "writable",
    get: ({ get }) => get(count),
    set: ({ set }, value) => set(count, value instanceof DefaultValue ? value : value + 1),
})
export const byId = atomFamily<number, { id: string }>({ key: "byId", default: param => param.id.length })
export const plus = selectorFamily<number, number>({
    key: "plus",
    get: amount => ({ get }) => get(count) + amount,
})
export const inferred = atom({ key: "inferred", default: 1 })
const native: State<number> = toValdresState(doubled)
const values: RecoilValue<number>[] = [count, doubled, writable, byId({ id: "a" }), plus(1)]
const guarded: boolean = isRecoilValue(native)
const feature: string = new UnsupportedRecoilFeatureError("x", "y").feature

// @ts-expect-error atom effects are not supported
atom({ key: "effects", default: 0, effects: [() => {}] })
// @ts-expect-error selectors receive no getCallback
selector({ key: "callback", get: ({ getCallback }) => getCallback })

export function Component(): ReactElement {
    const [value, setValue]: [number, SetterOrUpdater<number>] = useRecoilState(count)
    const total: number = useRecoilValue(doubled)
    // @ts-expect-error read-only selectors cannot be set
    useSetRecoilState(doubled)
    const reset: () => void = useResetRecoilState(writable)
    const run = useRecoilCallback(
        ({ snapshot, set, reset, transact_UNSTABLE }) =>
            (amount: number): Loadable<number> => {
                set(count, current => current + amount)
                reset(count)
                transact_UNSTABLE(({ get, set }) => set(count, get(count) + 1))
                return snapshot.getLoadable(doubled)
            },
        [],
    )
    // @ts-expect-error refresh is not supported
    useRecoilCallback(({ refresh }) => () => refresh(count))
    void [value, setValue, total, reset, run, values, guarded, feature]
    return RecoilRoot({
        initializeState: (snapshot: MutableSnapshot) => snapshot.set(count, 1),
        children: null,
    })
}
`

const workspace = await mkdtemp(join(tmpdir(), "valdres-recoil-packed-"))
let passed = false
try {
    const stage = join(workspace, "stage")
    const artifacts = join(workspace, "artifacts")
    await mkdir(join(stage, "scripts"), { recursive: true })
    await mkdir(artifacts, { recursive: true })
    for (const file of ["prepack.ts", "publish-metadata.ts"])
        await cp(join(ROOT, "scripts", file), join(stage, "scripts", file))

    for (const name of Object.keys(dirs) as Name[]) {
        run(`build ${name}`, ["bun", "run", "build"], dirs[name])
        run(`build ${name} types`, ["bun", "run", "build:types"], dirs[name])
    }

    // The adapter's behavior must not depend on NODE_ENV: its runtime mode is
    // whichever Valdres graph the application resolves.
    const adapterBundle = await readFile(join(PACKAGE, "dist/index.js"), "utf8")
    assert.ok(!adapterBundle.includes("process.env"), "adapter reads process.env")
    for (const specifier of ['"valdres"', '"valdres/adapter-internals/v1"', '"valdres-react"'])
        assert.ok(adapterBundle.includes(`from ${specifier}`), `adapter must import ${specifier}`)
    assert.ok(!/from "recoil"/.test(adapterBundle), "adapter imports recoil")

    const pending = pendingReleaseVersions(ROOT)
    const before = new Map<Name, string>()
    for (const name of Object.keys(dirs) as Name[])
        before.set(name, await readFile(join(dirs[name], "package.json"), "utf8"))

    const packed = new Map<Name, { tarball: string; manifest: any; files: string[] }>()
    for (const name of Object.keys(dirs) as Name[]) {
        const staged = join(stage, "packages", name)
        await mkdir(staged, { recursive: true })
        await cp(join(dirs[name], "dist"), join(staged, "dist"), { recursive: true })
        const manifest = JSON.parse(before.get(name)!)
        if (pending.has(name)) manifest.version = pending.get(name)
        await writeFile(join(staged, "package.json"), JSON.stringify(manifest, null, 4))
        run(`prepack ${name}`, ["bun", "run", join(stage, "scripts", "prepack.ts")], staged)
        const prepacked = JSON.parse(await readFile(join(staged, "package.json"), "utf8"))
        const result = run(
            `npm pack ${name}`,
            ["npm", "pack", "--ignore-scripts", "--json", "--pack-destination", artifacts],
            staged,
            { npm_config_loglevel: "error" },
        )
        const [entry] = JSON.parse(result.stdout)
        packed.set(name, {
            tarball: join(artifacts, basename(entry.filename)),
            manifest: prepacked,
            files: entry.files.map((file: { path: string }) => file.path),
        })
    }
    for (const name of Object.keys(dirs) as Name[])
        assert.equal(
            await readFile(join(dirs[name], "package.json"), "utf8"),
            before.get(name),
            `${name}/package.json changed`,
        )

    const adapter = packed.get("@valdres-react/recoil")!
    assert.deepEqual(adapter.manifest.exports, {
        ".": { types: "./dist/types/index.d.ts", import: "./dist/index.js", default: "./dist/index.js" },
    })
    assert.equal(adapter.manifest.dependencies, undefined)
    assert.ok(!JSON.stringify(adapter.manifest).includes("workspace:"), "workspace: range shipped")
    assert.ok(!adapter.files.some(file => file.startsWith("src/") || file.includes(".test.")))
    assert.ok(adapter.files.includes("dist/index.js"))
    assert.ok(adapter.files.includes("dist/types/index.d.ts"))
    for (const [peer, range] of Object.entries(adapter.manifest.peerDependencies) as [string, string][]) {
        const provided = packed.get(peer as Name)?.manifest.version
        if (provided !== undefined)
            assert.ok(Bun.semver.satisfies(provided, range), `peer ${peer}@${range} rejects ${provided}`)
        else assert.equal(peer, "react")
    }
    console.log(
        "packed:",
        [...packed].map(([name, p]) => `${name}@${p.manifest.version}`).join(", "),
    )

    const oracle = JSON.parse(await readFile(join(DIFFERENTIAL, "recoil-0.7.7.json"), "utf8"))

    for (const matrix of reactMatrix) {
        const consumer = join(workspace, `react-${matrix.major}`)
        await mkdir(consumer, { recursive: true })
        await writeFile(
            join(consumer, "package.json"),
            JSON.stringify(
                {
                    name: `valdres-recoil-consumer-react-${matrix.major}`,
                    private: true,
                    type: "module",
                    dependencies: {
                        ...Object.fromEntries(
                            [...packed].map(([name, p]) => [name, `file:${p.tarball}`]),
                        ),
                        react: matrix.react,
                        "react-dom": matrix.react,
                        "@types/react": matrix.types,
                        "@types/react-dom": matrix.typesDom,
                        "@happy-dom/global-registrator": "20.0.5",
                        "@testing-library/dom": "10.4.1",
                        "@testing-library/react": "16.3.0",
                        "happy-dom": "20.0.5",
                    },
                },
                null,
                2,
            ),
        )
        run(
            `install React ${matrix.major} consumer`,
            ["npm", "install", "--no-audit", "--no-fund", "--loglevel=error"],
            consumer,
        )
        for (const file of ["scenarios.ts", "runner.ts", "entry.ts"])
            await cp(join(DIFFERENTIAL, file), join(consumer, file))

        // The differential scenarios against the installed artifact. They
        // need act(), which production React builds do not have; production
        // is covered by the identity and server-rendering probes below.
        const { stdout } = run(
            `React ${matrix.major} differential`,
            ["bun", "entry.ts"],
            consumer,
            { LIB: "@valdres-react/recoil", NODE_ENV: "development" },
        )
        const report = JSON.parse(stdout.trim().split("\n").at(-1)!)
        assert.equal(report.react, matrix.react)
        const failures = compareWithOracle(scenarios, oracle.observations, report.observations)
        assert.deepEqual(failures, [], `React ${matrix.major} differential`)
        console.log(`React ${matrix.major}: ${scenarios.length} differential scenarios match recoil@0.7.7 expectations`)

        await writeFile(join(consumer, "identity.mjs"), IDENTITY_PROBE)
        for (const [runtime, conditions, graph, nodeEnv] of [
            ["node", [], "production", "production"],
            ["node", [], "production", "development"],
            ["node", ["--conditions=development"], "development", "development"],
            ["node", ["--conditions=development"], "development", "production"],
            ["bun", [], undefined, "production"],
            ["bun", ["--conditions=development"], "development", "development"],
        ] as const) {
            const label = `${runtime} ${conditions.join(" ") || "default conditions"} NODE_ENV=${nodeEnv}`
            const { stdout } = run(
                `React ${matrix.major} ${label} identity`,
                [runtime, ...conditions, "identity.mjs"],
                consumer,
                { NODE_ENV: nodeEnv, ...(graph === undefined ? {} : { EXPECT_GRAPH: graph }) },
            )
            console.log(`React ${matrix.major} ${label}: ${stdout.trim()}`)
        }

        await writeFile(join(consumer, "hydrate.mjs"), HYDRATION_PROBE)
        run(`React ${matrix.major} hydration`, ["node", "hydrate.mjs"], consumer)
        console.log(`React ${matrix.major}: server markup hydrates and updates`)

        await writeFile(join(consumer, "types.tsx"), TYPES_PROBE)
        for (const [resolution, module] of [
            ["bundler", "ESNext"],
            ["NodeNext", "NodeNext"],
        ] as const) {
            await writeFile(
                join(consumer, "tsconfig.json"),
                JSON.stringify({
                    compilerOptions: {
                        target: "ES2022",
                        lib: ["ES2022", "DOM"],
                        module,
                        moduleResolution: resolution,
                        jsx: "react-jsx",
                        strict: true,
                        skipLibCheck: false,
                        declaration: true,
                        emitDeclarationOnly: true,
                        outDir: "types-output",
                        types: [],
                    },
                    include: ["types.tsx"],
                }),
            )
            run(
                `React ${matrix.major} TypeScript (${resolution})`,
                ["node", join(ROOT, "node_modules/typescript/bin/tsc"), "-p", "tsconfig.json"],
                consumer,
            )
            const emitted = await readFile(join(consumer, "types-output/types.d.ts"), "utf8")
            assert.match(emitted, /RecoilState<number>/)
            assert.ok(!emitted.includes("/lib/"), "emitted declarations name internal paths")
        }
        console.log(`React ${matrix.major}: declarations compile and emit (bundler, NodeNext)`)
    }
    passed = true
    console.log("PACKED_OK")
} finally {
    if (passed && !process.env.KEEP_WORKSPACE) await rm(workspace, { recursive: true, force: true })
    else console.log(`workspace retained at ${workspace}`)
}
