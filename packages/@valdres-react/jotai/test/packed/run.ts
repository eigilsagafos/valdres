/**
 * Installed-tarball consumer for `@valdres-react/jotai`.
 *
 * Builds `valdres` and this package, stages each `dist` with the repository's
 * real `scripts/prepack.ts`, `npm pack`s them, installs the tarballs into
 * isolated consumers with React 18 and React 19, and checks against the
 * artifacts (not workspace source): store semantics on Node and Bun, both
 * export conditions resolving one Valdres runtime graph, server rendering,
 * hydration, StrictMode lifecycle and Suspense, and the packed declarations.
 * Source manifests must be unchanged afterwards.
 *
 * The package stays release-ignored; this gate only proves what the artifact
 * would do if it shipped.
 *
 *   bun run test:packed
 */
import { strict as assert } from "node:assert"
import { spawnSync } from "node:child_process"
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, join } from "node:path"

const PACKAGE = join(import.meta.dir, "../..")
const ROOT = join(PACKAGE, "../../..")
const FIXTURES = join(import.meta.dir, "fixtures")

const run = (
    label: string,
    command: readonly string[],
    cwd: string,
    env?: Record<string, string>,
) => {
    const result = spawnSync(command[0]!, command.slice(1), {
        cwd,
        encoding: "utf8",
        env: { ...process.env, ...env },
    })
    if (result.status !== 0) {
        console.error(
            `\n--- ${label} failed (exit ${result.status}) ---\n${result.stdout}\n${result.stderr}`,
        )
        process.exit(1)
    }
    return result
}

const dirs = {
    valdres: join(ROOT, "packages/valdres"),
    "@valdres-react/jotai": PACKAGE,
} as const
type Name = keyof typeof dirs

const reactMatrix = [
    { major: "18", runtime: "18.3.1", types: "18.3.31", typesDom: "18.3.7" },
    { major: "19", runtime: "19.1.1", types: "19.1.12", typesDom: "19.1.9" },
] as const

const workspace = await mkdtemp(join(tmpdir(), "valdres-jotai-packed-"))
console.log(`workspace: ${workspace}`)
const stage = join(workspace, "stage")
const artifacts = join(workspace, "artifacts")
await mkdir(join(stage, "scripts"), { recursive: true })
await mkdir(artifacts, { recursive: true })
for (const file of ["prepack.ts", "publish-metadata.ts"]) {
    await cp(join(ROOT, "scripts", file), join(stage, "scripts", file))
}

const before = new Map<Name, string>()
for (const name of Object.keys(dirs) as Name[]) {
    before.set(name, await readFile(join(dirs[name], "package.json"), "utf8"))
    run(`build ${name}`, ["bun", "run", "build"], dirs[name])
    run(`build ${name} types`, ["bun", "run", "build:types"], dirs[name])
}

// The bundle must leave Valdres and React to the consumer's resolution, so
// whichever export condition the application selects, it gets one graph.
const bundle = await readFile(join(PACKAGE, "dist/index.js"), "utf8")
const imports = [...bundle.matchAll(/from\s*"([^"]+)"/g)].map(m => m[1])
assert.deepEqual([...new Set(imports)].sort(), ["react", "valdres"])
assert.ok(!bundle.includes("process.env"), "bundle reads process.env")
console.log("bundle imports: react, valdres")

const packed = new Map<Name, { tarball: string; manifest: any; files: string[] }>()
for (const name of Object.keys(dirs) as Name[]) {
    const staged = join(stage, "packages", name)
    await mkdir(staged, { recursive: true })
    await cp(join(dirs[name], "dist"), join(staged, "dist"), { recursive: true })
    const manifest = JSON.parse(before.get(name)!)
    delete manifest.gitHead
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
for (const name of Object.keys(dirs) as Name[]) {
    assert.equal(
        await readFile(join(dirs[name], "package.json"), "utf8"),
        before.get(name),
        `${name}/package.json changed`,
    )
}
console.log("source manifests unchanged")

const jotai = packed.get("@valdres-react/jotai")!
assert.deepEqual(Object.keys(jotai.manifest.exports), ["."])
assert.equal(jotai.manifest.dependencies, undefined)
assert.deepEqual(Object.keys(jotai.manifest.peerDependencies).sort(), ["react", "valdres"])
assert.ok(
    Bun.semver.satisfies(
        packed.get("valdres")!.manifest.version,
        jotai.manifest.peerDependencies.valdres,
    ),
    "the valdres peer range rejects the packed core",
)
assert.ok(!jotai.files.some(file => file.startsWith("src/") || file.includes(".test.")))
assert.ok(!JSON.stringify(jotai.manifest).includes("workspace:"))
console.log(`tarball: ${jotai.files.join(", ")}`)

const declarations = (await readFile(join(PACKAGE, "test/types/declarations.tsx"), "utf8"))
    .replace('from "../../src/index"', 'from "@valdres-react/jotai"')

for (const react of reactMatrix) {
    const consumer = join(workspace, `react-${react.major}`)
    await mkdir(consumer, { recursive: true })
    await writeFile(
        join(consumer, "package.json"),
        JSON.stringify({ name: `valdres-jotai-react-${react.major}`, private: true, type: "module" }),
    )
    run(
        `install React ${react.runtime}`,
        [
            "npm",
            "install",
            "--ignore-scripts",
            "--no-audit",
            "--no-fund",
            "--no-package-lock",
            packed.get("valdres")!.tarball,
            jotai.tarball,
            `react@${react.runtime}`,
            `react-dom@${react.runtime}`,
            `@types/react@${react.types}`,
            `@types/react-dom@${react.typesDom}`,
            "@happy-dom/global-registrator@20.0.5",
        ],
        consumer,
        { npm_config_loglevel: "error" },
    )
    for (const fixture of ["vanilla.mjs", "ssr.mjs", "dom.mjs"]) {
        await cp(join(FIXTURES, fixture), join(consumer, fixture))
    }
    const env = { EXPECTED_REACT_MAJOR: react.major }
    for (const runtime of ["node", "bun"]) {
        for (const fixture of ["vanilla.mjs", "ssr.mjs", "dom.mjs"]) {
            const out = run(`${runtime} ${fixture} (React ${react.major})`, [runtime, fixture], consumer, env)
            console.log(`React ${react.major} ${runtime} ${fixture}: ${out.stdout.trim()}`)
        }
    }
    // The development export condition must select Valdres' development graph
    // for this package's imports too: still one runtime, now the debug one.
    const development = run(
        `node --conditions=development (React ${react.major})`,
        [
            "node",
            "--conditions=development",
            "--input-type=module",
            "-e",
            `const resolved = import.meta.resolve("valdres")
if (!resolved.includes("/dist/development/")) throw new Error("development condition not selected: " + resolved)
await import("./vanilla.mjs")`,
        ],
        consumer,
        env,
    )
    console.log(`React ${react.major} node --conditions=development: ${development.stdout.trim()}`)

    await writeFile(join(consumer, "declarations.tsx"), declarations)
    await writeFile(
        join(consumer, "tsconfig.json"),
        JSON.stringify({
            compilerOptions: {
                target: "ES2022",
                module: "NodeNext",
                moduleResolution: "NodeNext",
                lib: ["ES2022", "DOM"],
                jsx: "react-jsx",
                strict: true,
                noEmit: true,
                skipLibCheck: false,
                types: [],
            },
            include: ["declarations.tsx"],
        }),
    )
    run(
        `declarations (React ${react.major})`,
        [join(ROOT, "node_modules/.bin/tsc"), "-p", "tsconfig.json"],
        consumer,
    )
    console.log(`React ${react.major} declarations: ok (tsc, NodeNext, skipLibCheck false)`)
}

await rm(workspace, { recursive: true, force: true })
console.log("PACKED_OK")
