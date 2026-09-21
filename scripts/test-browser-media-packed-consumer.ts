/**
 * Packed-consumer gate for the migrated `@valdres/browser-*` media packages.
 *
 * The covered packages come from `scripts/lib/browser-media-packages.ts`, the
 * single explicit list shared with the test/typecheck runner — never a wildcard
 * over `packages/@valdres/*`.
 *
 * What this proves that a workspace-source import cannot: that the *published*
 * artifact works. Each package is staged into a throwaway directory with only
 * its `dist` output, run through the repository's own `scripts/prepack.ts` (so
 * the shipped `exports` map is what gets exercised, not the workspace
 * `./src/index.ts` map), packed with `npm pack`, and installed into an isolated
 * consumer that has no access to the workspace.
 *
 * It deliberately does NOT duplicate `scripts/test-v1-beta-packed-consumer.ts`
 * or `scripts/check-valdres-package.ts`: the core and React consumer matrix and
 * the published-core size budgets stay where they are. This gate builds the core
 * only because these packages need a core to run against.
 *
 *   bun run scripts/test-browser-media-packed-consumer.ts
 *   bun run test:browser-media:packed
 */
import { strict as assert } from "node:assert"
import { spawnSync } from "node:child_process"
import { statSync } from "node:fs"
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, join } from "node:path"
import { gzipSync } from "node:zlib"
import {
    BROWSER_MEDIA_CORE_PEER_RANGE,
    BROWSER_MEDIA_PACKAGES as MEDIA_PACKAGES,
} from "./lib/browser-media-packages"

const ROOT = join(import.meta.dir, "..")
const CORE = "valdres"

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
            `\n--- ${label} failed (exit ${result.status}) ---\n` +
                `${result.stdout}\n${result.stderr}`,
        )
        process.exit(1)
    }
    return result
}

const sourceDirectory = (name: string) =>
    name === CORE
        ? join(ROOT, "packages", CORE)
        : join(ROOT, "packages", "@valdres", name)

const workspace = await mkdtemp(join(tmpdir(), "valdres-browser-media-packed-"))
const stage = join(workspace, "stage")
const artifacts = join(workspace, "artifacts")
const consumer = join(workspace, "consumer")
await mkdir(join(stage, "scripts"), { recursive: true })
await mkdir(artifacts, { recursive: true })
await mkdir(consumer, { recursive: true })
for (const file of ["prepack.ts", "publish-metadata.ts"]) {
    await cp(join(ROOT, "scripts", file), join(stage, "scripts", file))
}

console.log(`packed-consumer workspace: ${workspace}\n`)

// 1. Build the core and every listed package from source.
run("build core", ["bun", "--filter", CORE, "build"], ROOT)
run("build core declarations", ["bun", "--filter", CORE, "build:types"], ROOT)
for (const media of MEDIA_PACKAGES) {
    const directory = sourceDirectory(media.dir)
    run(`build ${media.dir}`, ["bun", "run", "build"], directory)
    run(`build ${media.dir} declarations`, ["bun", "run", "build:types"], directory)
}

// 2. Capture every source manifest BEFORE staging, so the untouched-tree claim
//    below is an actual byte comparison rather than a liveness check.
const targets = [CORE, ...MEDIA_PACKAGES.map(media => media.dir)]
const manifestPath = (name: string) =>
    join(sourceDirectory(name), "package.json")
const manifestsBefore = new Map<string, string>()
for (const name of targets) {
    manifestsBefore.set(name, await readFile(manifestPath(name), "utf8"))
}

// 3. Shadow-stage, prepack and pack. The working tree is never the pack cwd.
interface Packed {
    readonly name: string
    readonly staged: string
    readonly tarball: string
    readonly manifest: {
        version: string
        name: string
        scripts?: unknown
        devDependencies?: unknown
        gitHead?: unknown
        peerDependencies?: Record<string, string>
        exports: Record<string, { types: string; import?: string; default: string }>
    }
}
const packed: Packed[] = []
for (const name of targets) {
    const staged = join(stage, "packages", name)
    await mkdir(staged, { recursive: true })
    await cp(join(sourceDirectory(name), "dist"), join(staged, "dist"), {
        recursive: true,
    })
    const manifest = JSON.parse(manifestsBefore.get(name)!) as Record<
        string,
        unknown
    >
    // npm derives gitHead from the checkout at publish time; a stale authored
    // value must not travel into the shadow tarball.
    delete manifest.gitHead
    await writeFile(join(staged, "package.json"), JSON.stringify(manifest, null, 4))

    run(
        `prepack ${name}`,
        ["bun", "run", join(stage, "scripts", "prepack.ts")],
        staged,
    )
    const prepacked = JSON.parse(
        await readFile(join(staged, "package.json"), "utf8"),
    ) as Packed["manifest"]
    assert.equal(prepacked.scripts, undefined, `${name} shipped scripts`)
    assert.equal(
        prepacked.devDependencies,
        undefined,
        `${name} shipped devDependencies`,
    )
    assert.equal(prepacked.gitHead, undefined, `${name} shipped gitHead`)
    for (const [subpath, entry] of Object.entries(prepacked.exports)) {
        for (const target of [entry.types, entry.import ?? entry.default]) {
            assert.ok(
                statSync(join(staged, target), { throwIfNoEntry: false }),
                `${name} ${subpath} points at a missing file: ${target}`,
            )
        }
    }

    const result = run(
        `npm pack ${name}`,
        [
            "npm",
            "pack",
            "--ignore-scripts",
            "--json",
            "--pack-destination",
            artifacts,
        ],
        staged,
        { npm_config_loglevel: "error" },
    )
    const [entry] = JSON.parse(result.stdout) as [
        { filename: string; files: { path: string }[] },
    ]
    const files = new Set(entry.files.map(file => file.path))
    assert.ok(files.has("dist/index.js"), `${name} tarball lacks dist/index.js`)
    assert.ok(
        files.has("dist/types/index.d.ts"),
        `${name} tarball lacks dist/types/index.d.ts`,
    )
    packed.push({
        name: prepacked.name,
        staged,
        tarball: join(artifacts, basename(entry.filename)),
        manifest: prepacked,
    })
}

// 4. Every source manifest must be byte-identical to what we read in step 2.
for (const name of targets) {
    assert.equal(
        await readFile(manifestPath(name), "utf8"),
        manifestsBefore.get(name),
        `${name}/package.json changed while shadow-packing`,
    )
}

const core = packed.find(entry => entry.name === CORE)!
const coreVersion = core.manifest.version

// 5. Peer ranges, through a real semver implementation. `Bun.semver` ships with
//    the pinned runtime, so this needs no dependency — and unlike a handwritten
//    comparison it gets prerelease ordering right, including a future stable
//    1.0.0 satisfying ^1.0.0-beta.39.
assert.equal(
    Bun.semver.satisfies("1.0.0", "^1.0.0-beta.39"),
    true,
    "semver self-check: a stable 1.0.0 must satisfy ^1.0.0-beta.39",
)
assert.equal(
    Bun.semver.satisfies("1.0.0-beta.19", "^1.0.0-beta.39"),
    false,
    "semver self-check: an older prerelease must not satisfy ^1.0.0-beta.39",
)
assert.equal(
    Bun.semver.satisfies("2.0.0", "^1.0.0-beta.39"),
    false,
    "semver self-check: a next major must not satisfy ^1.0.0-beta.39",
)
for (const entry of packed) {
    if (entry.name === CORE) continue
    const range = entry.manifest.peerDependencies?.[CORE]
    assert.ok(range, `${entry.name} declares no ${CORE} peer range`)
    // On the PREPACKED manifest — the one that would actually be published.
    // `satisfies` alone would pass for the pre-migration ^1.0.0-beta.19, which
    // admits cores without `externalAtom`, so pin the floor exactly.
    assert.equal(
        range,
        BROWSER_MEDIA_CORE_PEER_RANGE,
        `${entry.name} publishes peer range ${range}, expected ${BROWSER_MEDIA_CORE_PEER_RANGE}`,
    )
    assert.ok(
        Bun.semver.satisfies(coreVersion, range),
        `${entry.name} peer range ${range} does not admit the packed core ${coreVersion}`,
    )
}

// 6. Install the tarballs into an isolated consumer.
await writeFile(
    join(consumer, "package.json"),
    JSON.stringify(
        {
            name: "valdres-browser-media-packed-consumer",
            private: true,
            type: "module",
            dependencies: Object.fromEntries(
                packed.map(entry => [entry.name, `file:${entry.tarball}`]),
            ),
        },
        null,
        2,
    ),
)
run(
    "install consumer",
    ["npm", "install", "--no-audit", "--no-fund", "--loglevel=error"],
    consumer,
)

// 7. Browserless: Node, no `window` at all.
await writeFile(
    join(consumer, "browserless.mjs"),
    `import { strict as assert } from "node:assert"
import { store } from "valdres"

assert.equal(typeof globalThis.window, "undefined", "this probe must have no DOM")
${MEDIA_PACKAGES.map(
    media => `
{
    const mod = await import("@valdres/${media.dir}")
    const app = store()
    assert.equal(app.get(mod.${media.atom}), ${JSON.stringify(media.unavailable)})
    assert.equal(app.get(mod.${media.selector}), false)
    const stop = app.sub(mod.${media.atom}, () => {
        throw new Error("${media.dir}: a DOM-less source must never notify")
    })
    assert.equal(typeof stop, "function")
    stop()
    for (const [operation, call] of [
        ["set", () => app.set(mod.${media.atom}, ${JSON.stringify(media.live)})],
        ["reset", () => app.reset(mod.${media.atom})],
        ["update", () => app.update(mod.${media.atom}, () => ${JSON.stringify(media.live)})],
    ]) {
        let thrown
        try { call() } catch (error) { thrown = error }
        assert.ok(
            thrown instanceof TypeError,
            "${media.dir}: " + operation + " must reject an external source",
        )
    }
    app.dispose()
}`,
).join("\n")}
console.log("BROWSERLESS_OK ${MEDIA_PACKAGES.length}")
`,
)
run("browserless consumer", ["node", "browserless.mjs"], consumer)

// 8. DOM consumer, one fresh process per package: attach, notify, clean up —
//    all through the installed artifact, never workspace source.
for (const media of MEDIA_PACKAGES) {
    await writeFile(
        join(consumer, `dom-${media.dir}.mjs`),
        `import { strict as assert } from "node:assert"
import { store } from "valdres"

let matches = false
const listeners = new Set()
let attached = 0
let released = 0
globalThis.window = {
    matchMedia: query => ({
        media: query,
        get matches() {
            return query === ${JSON.stringify(media.query)} ? matches : false
        },
        addEventListener: (type, listener) => {
            if (type === "change") { attached++; listeners.add(listener) }
        },
        removeEventListener: (type, listener) => {
            if (type === "change") { released++; listeners.delete(listener) }
        },
    }),
}

const mod = await import("@valdres/${media.dir}")
const app = store()
assert.equal(app.get(mod.${media.atom}), ${JSON.stringify(media.unavailable)})
assert.equal(attached, 0, "a dormant read must not attach")

const seen = []
const stop = app.sub(mod.${media.atom}, () => seen.push(app.get(mod.${media.atom})))
assert.ok(attached > 0, "subscribing must attach")
matches = true
for (const listener of [...listeners]) listener(new Event("change"))
assert.deepEqual(seen, [${JSON.stringify(media.live)}])
assert.equal(app.get(mod.${media.selector}), true)
stop()
assert.equal(released, attached, "cleanup must release every listener attached")
app.dispose()
console.log("DOM_OK ${media.dir}")
`,
    )
    run(`dom consumer ${media.dir}`, ["node", `dom-${media.dir}.mjs`], consumer)
}

// 9. TypeScript consumer: the packed declarations must resolve and must still
//    reject writes.
await writeFile(
    join(consumer, "tsconfig.json"),
    JSON.stringify(
        {
            compilerOptions: {
                target: "ESNext",
                module: "ESNext",
                moduleResolution: "bundler",
                lib: ["ESNext", "DOM"],
                strict: true,
                noEmit: true,
                skipLibCheck: true,
            },
            include: ["types.ts"],
        },
        null,
        2,
    ),
)
await writeFile(
    join(consumer, "types.ts"),
    `import { store } from "valdres"
${MEDIA_PACKAGES.map(
    media =>
        `import { ${media.atom}, ${media.selector} } from "@valdres/${media.dir}"`,
).join("\n")}

const app = store()
${MEDIA_PACKAGES.map(
    media => `const ${media.atom}Value: string = app.get(${media.atom})
const ${media.selector}Value: boolean = app.get(${media.selector})
// @ts-expect-error packed declarations keep the source read-only
app.set(${media.atom}, ${JSON.stringify(media.live)})
// @ts-expect-error packed declarations keep the source read-only
app.update(${media.atom}, () => ${JSON.stringify(media.live)})
void ${media.atom}Value
void ${media.selector}Value`,
).join("\n")}
`,
)
run(
    "typescript consumer",
    [join(ROOT, "node_modules", ".bin", "tsgo"), "--noEmit", "-p", "tsconfig.json"],
    consumer,
)

// 10. Sizes, measured on the shadow-staged dist with the core external.
const bytes = (path: string) => statSync(path).size
const rows: string[] = []
for (const entry of packed) {
    if (entry.name === CORE) continue
    const short = entry.name.slice("@valdres/".length)
    const dist = join(entry.staged, "dist", "index.js")
    const minified = join(workspace, `${short}.min.js`)
    run(
        `minify ${short}`,
        ["bun", "build", dist, "--minify", "--packages", "external", "--outfile", minified],
        workspace,
    )
    const gzipped = gzipSync(await readFile(minified)).length
    rows.push(
        `  ${short.padEnd(30)}` +
            ` tarball ${String(bytes(entry.tarball)).padStart(6)} B` +
            `  dist/index.js ${String(bytes(dist)).padStart(5)} B` +
            `  min+gzip ${String(gzipped).padStart(4)} B`,
    )
}
console.log("per-package consumer size (valdres external):")
console.log(rows.join("\n"))
console.log(`\ncore under test: ${CORE}@${coreVersion}`)
console.log(
    `\nPacked consumer gate passed for ${MEDIA_PACKAGES.length} media packages ` +
        `against ${CORE}@${coreVersion}: browserless import, DOM attach/notify/cleanup, ` +
        `packed declarations and peer ranges.`,
)
await rm(workspace, { recursive: true, force: true })
