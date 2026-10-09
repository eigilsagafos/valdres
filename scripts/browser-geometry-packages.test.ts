/**
 * Guards the browser-geometry lane's metadata and its testing-only status.
 * Picked up by CI's existing `bun test scripts/` step.
 *
 * The packages are migrated and gated by `scripts/check-browser-geometry.ts`
 * and the packed consumer gate, but not release-eligible: they are still
 * Changesets-ignored and off the publishable list. Release enablement has to
 * flip `releaseEligible` and the assertions below deliberately, in one change,
 * rather than drifting into a half-enabled state.
 */
import { describe, expect, test } from "bun:test"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import {
    BROWSER_GEOMETRY_CORE_PEER_RANGE,
    BROWSER_GEOMETRY_FLOOR,
    BROWSER_GEOMETRY_LEGACY_VERSION,
    BROWSER_GEOMETRY_PACKAGES,
} from "./lib/browser-geometry-packages"
import { BROWSER_MEDIA_PACKAGES } from "./lib/browser-media-packages"
import { BROWSER_STATUS_PACKAGES } from "./lib/browser-status-packages"
import { loadChangesetParser } from "./lib/browser-status-release-note"
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

const names = BROWSER_GEOMETRY_PACKAGES.map(pkg => pkg.name) as string[]
const ignored = (): string[] =>
    JSON.parse(read(ROOT, ".changeset", "config.json")).ignore

describe("browser-geometry lane", () => {
    test("is unique and covers only real packages", () => {
        expect(new Set(names).size).toBe(names.length)
        for (const { dir, name } of BROWSER_GEOMETRY_PACKAGES) {
            const manifest = JSON.parse(read(ROOT, dir, "package.json"))
            expect(manifest.name).toBe(name)
        }
    })

    test("stays out of the media and status registries", () => {
        const other = [
            ...BROWSER_MEDIA_PACKAGES.map(pkg => `@valdres/${pkg.dir}`),
            ...BROWSER_STATUS_PACKAGES.map(pkg => pkg.name),
        ]
        for (const name of names) expect(other).not.toContain(name)
    })

    for (const { dir, name, atom } of BROWSER_GEOMETRY_PACKAGES) {
        describe(name, () => {
            const directory = join(ROOT, dir)

            test("has the wiring the gates assume", () => {
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
                    valdres: BROWSER_GEOMETRY_CORE_PEER_RANGE,
                })
                expect(manifest.dependencies).toBeUndefined()
            })

            test("is migrated onto public v1 primitives only", () => {
                const sources = sourceFiles(join(directory, "src"))
                expect(sources.length).toBeGreaterThan(0)
                for (const path of sources) {
                    const source = readFileSync(path, "utf8")
                    expect(source).not.toContain("globalAtom")
                    expect(source).not.toContain("globalStore")
                    expect(source).not.toMatch(
                        /\b(setSelf|getSelf|resetSelf|onMount)\b/,
                    )
                    // The root `valdres` entry and relative modules, nothing
                    // private: no deep core paths, no adapter internals.
                    for (const [, specifier] of source.matchAll(
                        /\bfrom\s+"([^"]+)"/g,
                    ))
                        expect({ path, specifier }).toEqual({
                            path,
                            specifier: specifier!.startsWith(".")
                                ? specifier!
                                : "valdres",
                        })
                }
            })

            test("publishes exactly one external atom", () => {
                const sources = sourceFiles(join(directory, "src")).map(path =>
                    readFileSync(path, "utf8"),
                )
                const constructions = sources.flatMap(
                    source => source.match(/\bexternalAtom\(/g) ?? [],
                )
                expect(constructions).toHaveLength(1)
                expect(read(directory, "src/atoms", `${atom}.ts`)).toContain(
                    "externalAtom(",
                )
                expect(read(directory, "src/index.ts")).toContain(
                    `export { ${atom} }`,
                )
            })

            test("is tested but not release-eligible, in both halves of the pipeline", () => {
                const release = BROWSER_GEOMETRY_PACKAGES.find(
                    pkg => pkg.name === name,
                )!.releaseEligible
                expect(release).toBe(false)
                // These must move together: `changeset publish` publishes every
                // non-ignored package, but only listed packages are prepacked.
                expect(ignored().includes(name)).toBe(!release)
                expect(PUBLISHABLE_PACKAGE_DIRS.includes(dir)).toBe(release)
            })

            test("carries no changeset mixing ignored and released packages", () => {
                // Changesets rejects a mixed changeset for the whole repository.
                const ignore = ignored()
                for (const file of changesetFiles()) {
                    const front = frontMatterNames(file)
                    if (!front.includes(name)) continue
                    const mixed =
                        front.some(other => ignore.includes(other)) &&
                        front.some(other => !ignore.includes(other))
                    expect({ file, mixed }).toEqual({ file, mixed: false })
                }
            })

            test("is still at the legacy version, so release enablement must publish past it", () => {
                const manifest = JSON.parse(read(directory, "package.json"))
                expect(manifest.version).toBe(BROWSER_GEOMETRY_LEGACY_VERSION)
            })
        })
    }

    test("never gates publish while release-ignored", () => {
        // The CI job is wired separately (see the integration handoff); when it
        // exists it must stay out of publish's needs until release enablement.
        const workflow = read(ROOT, ".github", "workflows", "ci.yaml")
        const needs = workflow.match(
            /^    publish:[\s\S]*?\n        needs: \[([^\]]*)\]/m,
        )
        expect(needs).not.toBeNull()
        expect(needs![1]!.split(",").map(job => job.trim())).not.toContain(
            "browser-geometry",
        )
    })

    test("the peer floor excludes cores without externalAtom", () => {
        const range = BROWSER_GEOMETRY_CORE_PEER_RANGE
        expect(Bun.semver.satisfies("1.0.0-beta.39", range)).toBe(true)
        expect(Bun.semver.satisfies("1.0.0-beta.44", range)).toBe(true)
        expect(Bun.semver.satisfies("1.0.0", range)).toBe(true)
        expect(Bun.semver.satisfies("1.0.0-beta.38", range)).toBe(false)
        expect(Bun.semver.satisfies("1.0.0-beta.19", range)).toBe(false)
        expect(Bun.semver.satisfies("2.0.0", range)).toBe(false)
    })

    test("the packed gate executes the declared floor itself", () => {
        // The gate installs this published pair; it must be the range's floor,
        // or a passing gate would prove a different claim than the manifests make.
        expect(`^${BROWSER_GEOMETRY_FLOOR.valdres}`).toBe(
            BROWSER_GEOMETRY_CORE_PEER_RANGE,
        )
    })
})
