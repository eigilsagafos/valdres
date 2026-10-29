/**
 * Guards the network lane's metadata and its testing-only status. Picked up
 * by CI's existing `bun test scripts/` step.
 *
 * `@valdres/public-ip` and `@valdres/bandwidth` are migrated and gated by
 * ci.yaml's `network` job (`scripts/check-network.ts` and the packed consumer
 * gate), but not release-eligible: they are still Changesets-ignored, off the
 * publishable list and out of `publish.needs`. Release enablement has to flip
 * `releaseEligible` and the assertions below deliberately, in one change,
 * rather than drifting into a half-enabled state.
 */
import { describe, expect, test } from "bun:test"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { BROWSER_GEOMETRY_PACKAGES } from "./lib/browser-geometry-packages"
import { BROWSER_MEDIA_PACKAGES } from "./lib/browser-media-packages"
import { BROWSER_PERMISSION_PACKAGES } from "./lib/browser-permission-packages"
import { BROWSER_STATUS_PACKAGES } from "./lib/browser-status-packages"
import { loadChangesetParser } from "./lib/browser-status-release-note"
import {
    NETWORK_BELOW_FLOOR,
    NETWORK_CORE_PEER_RANGE,
    NETWORK_FLOOR,
    NETWORK_LEGACY_VERSION,
    NETWORK_PACKAGES,
} from "./lib/network-packages"
import { PUBLISHABLE_PACKAGE_DIRS } from "./lib/publishable-packages"

const ROOT = join(import.meta.dir, "..")
const read = (...parts: string[]) => readFileSync(join(...parts), "utf8")

const sourceFiles = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const path = join(dir, entry.name)
        if (entry.isDirectory()) return sourceFiles(path)
        return entry.name.endsWith(".ts") && !entry.name.includes(".test.")
            ? [path]
            : []
    })

const changesetFiles = (dir = join(ROOT, ".changeset")): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const path = join(dir, entry.name)
        if (entry.isDirectory()) return changesetFiles(path)
        return entry.name.endsWith(".md") && entry.name !== "README.md"
            ? [path]
            : []
    })

// Changesets' own parser: any valid YAML key style, malformed files rejected.
const parseChangeset = await loadChangesetParser(ROOT)
const frontMatterNames = (file: string): string[] =>
    parseChangeset(readFileSync(file, "utf8")).releases.map(
        release => release.name,
    )

const names = NETWORK_PACKAGES.map(pkg => pkg.name) as string[]
const ignored = (): string[] =>
    JSON.parse(read(ROOT, ".changeset", "config.json")).ignore
const ciYaml = () => read(ROOT, ".github", "workflows", "ci.yaml")
/** The text of one top-level job in ci.yaml, up to the next job. */
const ciJob = (name: string): string | undefined => {
    const lines = ciYaml().split("\n")
    const start = lines.indexOf(`    ${name}:`)
    if (start === -1) return undefined
    const rest = lines.slice(start + 1)
    const end = rest.findIndex(line => /^    [a-z][a-z-]*:$/.test(line))
    return rest.slice(0, end === -1 ? undefined : end).join("\n") + "\n"
}

/** Every module path a source file imports or re-exports from. */
const specifiers = (source: string) =>
    [...source.matchAll(/\bfrom\s+"([^"]+)"/g)].map(match => match[1]!)

describe("network lane", () => {
    test("is unique and covers only real packages", () => {
        expect(new Set(names).size).toBe(names.length)
        for (const { dir, name } of NETWORK_PACKAGES)
            expect(JSON.parse(read(ROOT, dir, "package.json")).name).toBe(name)
    })

    test("stays out of the other lanes", () => {
        const other = [
            ...BROWSER_MEDIA_PACKAGES.map(pkg => `@valdres/${pkg.dir}`),
            ...BROWSER_STATUS_PACKAGES.map(pkg => pkg.name),
            ...BROWSER_PERMISSION_PACKAGES.map(pkg => pkg.name),
            ...BROWSER_GEOMETRY_PACKAGES.map(pkg => pkg.name),
        ]
        for (const name of names) expect(other).not.toContain(name)
    })

    test("its ci.yaml job runs both gates through the root scripts", () => {
        const job = ciJob("network")
        expect(job).toBeString()
        expect(job).toContain("run: bun run test:network\n")
        expect(job).toContain("run: bun run test:network:packed\n")
        const scripts = JSON.parse(read(ROOT, "package.json")).scripts
        expect(scripts["test:network"]).toBe("bun run scripts/check-network.ts")
        expect(scripts["test:network:packed"]).toBe(
            "bun run scripts/test-network-packed-consumer.ts",
        )
    })

    test("verify runs the job, and publish waits on it exactly when the packages release", () => {
        expect(read(ROOT, "scripts", "verify.ts")).toMatch(
            /const JOBS = \[[^\]]*"network"/,
        )
        const needs = ciYaml().match(
            /^    publish:[\s\S]*?\n        needs: \[([^\]]*)\]/m,
        )
        expect(needs).not.toBeNull()
        const gating = needs![1]!.split(",").map(job => job.trim())
        const eligible = NETWORK_PACKAGES.some(pkg => pkg.releaseEligible)
        expect(gating.includes("network")).toBe(eligible)
    })

    test("the peer floor is the first core with externalAtom, and the gate executes it", () => {
        const range = NETWORK_CORE_PEER_RANGE
        expect(Bun.semver.satisfies(NETWORK_FLOOR.valdres, range)).toBe(true)
        expect(Bun.semver.satisfies("1.0.0", range)).toBe(true)
        expect(Bun.semver.satisfies(NETWORK_BELOW_FLOOR, range)).toBe(false)
        expect(Bun.semver.satisfies("1.0.0-beta.19", range)).toBe(false)
        expect(Bun.semver.satisfies("2.0.0", range)).toBe(false)
        // The gate installs this published pair; it must be the range's floor,
        // or a passing gate would prove a different claim than the manifests make.
        expect(`^${NETWORK_FLOOR.valdres}`).toBe(range)
    })

    for (const pkg of NETWORK_PACKAGES) {
        describe(pkg.name, () => {
            const directory = join(ROOT, pkg.dir)

            test("has the wiring the gates assume and the exact peer floor", () => {
                const manifest = JSON.parse(read(directory, "package.json"))
                expect(manifest.private).toBeUndefined()
                for (const script of [
                    "build",
                    "build:types",
                    "test",
                    "test:ci",
                    "typecheck:tests",
                ])
                    expect(manifest.scripts?.[script]).toBeString()
                expect(manifest.scripts["typecheck:tests"]).toContain(
                    "tsconfig.tests.json",
                )
                expect(existsSync(join(directory, "tsconfig.tests.json"))).toBe(
                    true,
                )
                expect(manifest.peerDependencies).toEqual({
                    valdres: NETWORK_CORE_PEER_RANGE,
                })
                expect(manifest.dependencies).toBeUndefined()
            })

            test("is migrated onto public v1 primitives only", () => {
                const sources = sourceFiles(join(directory, "src"))
                expect(sources.length).toBeGreaterThan(0)
                for (const path of sources) {
                    const source = readFileSync(path, "utf8")
                    for (const retired of [
                        "globalAtom",
                        "globalStore",
                        "maxAge",
                        "staleWhileRevalidate",
                        "staleIfError",
                    ])
                        expect({
                            path,
                            retired,
                            found: source.includes(retired),
                        }).toEqual({ path, retired, found: false })
                    expect(source).not.toMatch(
                        /\b(setSelf|getSelf|resetSelf|onMount)\b/,
                    )
                    // The root `valdres` entry and relative modules, nothing
                    // private: no deep core paths, no adapter internals.
                    for (const specifier of specifiers(source))
                        expect({ path, specifier }).toEqual({
                            path,
                            specifier: specifier.startsWith(".")
                                ? specifier
                                : "valdres",
                        })
                }
            })

            test("starts network work only from its documented operation", () => {
                // Every fetch lives in lib/, behind the one exported operation
                // (the import-inert and packed gates prove nothing else reaches it).
                const operation =
                    pkg.name === "@valdres/public-ip"
                        ? "requestPublicIp"
                        : "measureBandwidth"
                for (const path of sourceFiles(join(directory, "src"))) {
                    const source = readFileSync(path, "utf8")
                    if (!/\bfetch\(/.test(source)) continue
                    expect({ path, inLib: path.includes("/src/lib/") }).toEqual(
                        { path, inLib: true },
                    )
                }
                expect(read(directory, "src/index.ts")).toContain(
                    `export { ${operation} }`,
                )
            })

            test("is tested but not release-eligible, in both halves of the pipeline", () => {
                expect(pkg.releaseEligible).toBe(false)
                // These must move together: `changeset publish` publishes every
                // non-ignored package, but only listed packages are prepacked.
                expect(ignored().includes(pkg.name)).toBe(!pkg.releaseEligible)
                expect(PUBLISHABLE_PACKAGE_DIRS.includes(pkg.dir)).toBe(
                    pkg.releaseEligible,
                )
            })

            test("carries no changeset mixing ignored and released packages", () => {
                // Changesets rejects a mixed changeset for the whole repository.
                const ignore = ignored()
                for (const file of changesetFiles()) {
                    const front = frontMatterNames(file)
                    if (!front.includes(pkg.name)) continue
                    const mixed =
                        front.some(other => ignore.includes(other)) &&
                        front.some(other => !ignore.includes(other))
                    expect({ file, mixed }).toEqual({ file, mixed: false })
                }
            })

            test("is still at the legacy version, so release enablement must publish past it", () => {
                expect(
                    JSON.parse(read(directory, "package.json")).version,
                ).toBe(NETWORK_LEGACY_VERSION)
            })
        })
    }
})
