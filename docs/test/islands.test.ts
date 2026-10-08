/**
 * The docs islands on Valdres v1: what the shipped bundles may contain, and how
 * their demos behave across mounting and client-side navigation.
 *
 * scripts/check-docs-islands.ts proves each bundle can load. This proves the
 * demos work once loaded, that leaving a page releases its subscriptions and
 * Stores, and that integrations not yet migrated to v1 stay out of the bundles
 * and render their notice instead. Each browser scenario runs as a fixture in
 * its own process; see fixtures/browser.ts.
 *
 * Run with `bun run test:docs`.
 */
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import {
    bundleClient,
    bundleDemos,
    bundleLanding,
    islandDefine,
    readValdresVersion,
} from "../src/islands-build"
import { v1Unavailable } from "../src/islands/unavailable"

// Bundling the islands and running each browser fixture in its own process
// takes well under a second locally; leave room for a slow runner.
setDefaultTimeout(60_000)

const rootDir = resolve(import.meta.dir, "../..")
const fixtures = join(import.meta.dir, "fixtures")

let outdir: string
let version: string
const bundledInputs: Record<string, string[]> = {}

beforeAll(async () => {
    outdir = await mkdtemp(join(tmpdir(), "valdres-docs-islands-"))
    version = await readValdresVersion(rootDir)
    const define = islandDefine(version, "production")
    for (const [name, bundle] of [
        ["client.js", bundleClient],
        ["demos.js", bundleDemos],
        ["landing.js", bundleLanding],
    ] as const) {
        const result = await bundle({ outdir, minify: true, define, metafile: true })
        if (!result.success) throw new AggregateError(result.logs, `${name} failed to build`)
        // bun-types 1.2 predates the runtime's `metafile` result.
        const { metafile } = result as unknown as { metafile: { inputs: Record<string, unknown> } }
        bundledInputs[name] = Object.keys(metafile.inputs).map(input =>
            resolve(process.cwd(), input),
        )
    }
})

afterAll(async () => {
    await rm(outdir, { recursive: true, force: true })
})

/** Source paths that must never be bundled, per v1Unavailable key. */
const unavailableSources = (key: string) => {
    if (key === "valdres/cache") {
        return [
            join(rootDir, "docs/src/islands/demos/cache-demo.tsx"),
            join(rootDir, "packages/valdres/src/cacheMeta.ts"),
        ]
    }
    return [join(rootDir, "packages", key) + "/"]
}

describe("v1 module boundary", () => {
    for (const bundle of ["demos.js", "landing.js"]) {
        test(`${bundle} bundles no integration that v1 cannot run`, () => {
            const inputs = bundledInputs[bundle]
            const leaked = Object.keys(v1Unavailable).flatMap(key =>
                unavailableSources(key)
                    .filter(source => inputs.some(input => input.startsWith(source)))
                    .map(source => `${key}: ${source}`),
            )
            expect(leaked).toEqual([])
        })
    }

    test("the legacy islands those integrations need stay out", () => {
        const legacy = [
            "angular-counter.ts",
            "landing-location.tsx",
            "plugins/ScreenPlacement.tsx",
            "solid-counter.ts",
            "SvelteCounter.svelte",
            "svelte-counter.ts",
            "vue-counter.ts",
        ].map(file => join(rootDir, "docs/src/islands", file))
        const bundled = [...bundledInputs["demos.js"], ...bundledInputs["landing.js"]]
        expect(legacy.filter(file => bundled.includes(file))).toEqual([])
    })

    test("client.js stays valdres-free beside demos.js and landing.js", () => {
        // A realm accepts one valdres runtime, and client.js loads on every page.
        expect(
            bundledInputs["client.js"].filter(input => input.startsWith(join(rootDir, "packages"))),
        ).toEqual([])
    })

    test("the boundary check sees the real module graph", () => {
        // Guards the assertions above against a metafile that lists nothing.
        for (const source of [
            "packages/valdres/src/index.ts",
            "packages/valdres-react/src/index.ts",
            "packages/@valdres/browser-online/src/index.ts",
            "docs/src/islands/demos/todo-list.ts",
        ]) {
            expect(bundledInputs["demos.js"]).toContain(join(rootDir, source))
        }
        expect(bundledInputs["landing.js"]).toContain(
            join(rootDir, "docs/src/islands/react-counter.tsx"),
        )
    })
})

type Check = { ok: boolean; message: string }

const runFixture = (fixture: string, ...args: string[]): Check[] => {
    const result = Bun.spawnSync(["bun", join(fixtures, fixture), ...args], {
        cwd: rootDir,
        stdout: "pipe",
        stderr: "pipe",
    })
    const stdout = result.stdout.toString()
    const line = stdout.split("\n").find(l => l.startsWith("__checks__"))
    if (result.exitCode !== 0 || !line) {
        throw new Error(
            `${fixture} did not report (exit ${result.exitCode})\n${stdout}\n${result.stderr}`,
        )
    }
    return JSON.parse(line.slice("__checks__".length))
}

const expectAllPass = (checks: Check[]) => {
    expect(checks.length).toBeGreaterThan(0)
    expect(checks.filter(c => !c.ok).map(c => c.message)).toEqual([])
}

describe("demos.js", () => {
    test("demos work and are released across client-side navigation", () => {
        expectAllPass(runFixture("navigation.ts", outdir))
    })
})

describe("landing.js", () => {
    test("the React counter runs and unmigrated cards show notices", () => {
        expectAllPass(runFixture("landing.ts", outdir))
    })
})

describe("site theme", () => {
    for (const layout of ["docs", "landing"]) {
        test(`${layout}: follows the OS for "system", never over an explicit choice, without accumulating listeners`, () => {
            expectAllPass(runFixture("theme.ts", outdir, layout))
        })
    }
})

describe("todo and family demos", () => {
    const redirectToSpy: import("bun").BunPlugin = {
        name: "valdres-spy",
        setup(build) {
            build.onResolve({ filter: /^valdres$/ }, args =>
                args.importer.includes("/docs/src/islands/demos/")
                    ? { path: join(fixtures, "valdres-spy.ts") }
                    : undefined,
            )
        },
    }

    for (const mode of ["production", "development"] as const) {
        test(`subscribe once, never write from notifications, release on cleanup (${mode})`, async () => {
            const result = await Bun.build({
                entrypoints: [join(fixtures, "demo-behavior-entry.ts")],
                outdir,
                naming: `demo-behavior-${mode}.js`,
                minify: true,
                target: "browser",
                plugins: [redirectToSpy],
                define: islandDefine(version, mode),
            })
            expect(result.success).toBe(true)
            expectAllPass(runFixture("demo-behavior.ts", join(outdir, `demo-behavior-${mode}.js`)))
        })
    }
})
