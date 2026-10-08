/**
 * Guards the browser-status lane's metadata and release state. Picked up by
 * CI's existing `bun test scripts/` step.
 *
 * Stage A: online, focus and visibility are release-eligible (off the
 * Changesets ignore list, on the publishable list, `browser-status` gates
 * `publish`). Presence stays release-ignored until Stage B raises its
 * focus/visibility ranges past the legacy builds. Each package's
 * `releaseEligible` flag is the single claim checked here, so a package cannot
 * drift into a half-enabled state.
 */
import { describe, expect, test } from "bun:test"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import {
    BROWSER_STATUS_CORE_PEER_RANGE,
    BROWSER_STATUS_FLOOR,
    BROWSER_STATUS_LEGACY_VERSION,
    BROWSER_STATUS_PACKAGES,
} from "./lib/browser-status-packages"
import {
    STAGE_A_PACKAGES,
    loadChangesetParser,
    readReleaseNoteState,
    stageANoteProblems,
} from "./lib/browser-status-release-note"
import { BROWSER_MEDIA_PACKAGES } from "./lib/browser-media-packages"
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

const names = BROWSER_STATUS_PACKAGES.map(pkg => pkg.name) as string[]
const eligible = BROWSER_STATUS_PACKAGES.filter(pkg => pkg.releaseEligible).map(
    pkg => pkg.name,
) as string[]
const PRESENCE = "@valdres/browser-presence"
const ignored = (): string[] =>
    JSON.parse(read(ROOT, ".changeset", "config.json")).ignore

describe("browser-status lane", () => {
    test("is unique and covers only real packages", () => {
        expect(new Set(names).size).toBe(names.length)
        for (const { dir, name } of BROWSER_STATUS_PACKAGES) {
            const manifest = JSON.parse(read(ROOT, dir, "package.json"))
            expect(manifest.name).toBe(name)
        }
    })

    test("stays out of the media registry", () => {
        const media = BROWSER_MEDIA_PACKAGES.map(pkg => `@valdres/${pkg.dir}`)
        for (const name of names) expect(media).not.toContain(name)
    })

    for (const { dir, name } of BROWSER_STATUS_PACKAGES) {
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
                expect(manifest.peerDependencies?.valdres).toBe(
                    BROWSER_STATUS_CORE_PEER_RANGE,
                )
            })

            test("is migrated onto public v1 primitives", () => {
                const sources = sourceFiles(join(directory, "src"))
                expect(sources.length).toBeGreaterThan(0)
                for (const path of sources) {
                    const source = readFileSync(path, "utf8")
                    expect(source).not.toContain("globalAtom")
                    expect(source).not.toMatch(/\b(setSelf|getSelf|onMount)\b/)
                }
            })

            test("release eligibility matches its stage, in both halves of the pipeline", () => {
                const release = BROWSER_STATUS_PACKAGES.find(
                    pkg => pkg.name === name,
                )!.releaseEligible
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
        })
    }

    test("Stage A's migration note holds its pending, consumed or released state", () => {
        // Follows the one note by id (scripts/lib/browser-status-release-note.ts);
        // fixture cases for each lifecycle state live next to it.
        expect(stageANoteProblems(readReleaseNoteState(ROOT), parseChangeset)).toEqual(
            [],
        )
    })

    test("Stage A's packages stay release-eligible", () => {
        for (const name of STAGE_A_PACKAGES) expect(eligible).toContain(name)
    })

    test("presence stays release-ignored while its ranges admit the legacy builds", () => {
        const manifest = JSON.parse(
            read(ROOT, "packages/@valdres/browser-presence", "package.json"),
        )
        const admitsLegacy = [
            "@valdres/browser-focus",
            "@valdres/browser-visibility",
        ].some(dep =>
            Bun.semver.satisfies(
                BROWSER_STATUS_LEGACY_VERSION,
                manifest.dependencies[dep],
            ),
        )
        const releasable =
            !ignored().includes(PRESENCE) ||
            PUBLISHABLE_PACKAGE_DIRS.includes("packages/@valdres/browser-presence")
        expect({ admitsLegacy, releasable }).not.toEqual({
            admitsLegacy: true,
            releasable: true,
        })
        // Stage A: presence is still the ignored one.
        expect(eligible).not.toContain(PRESENCE)
    })

    test("online, focus and visibility each publish one external atom", () => {
        for (const [dir, atom] of [
            ["browser-online", "onlineAtom"],
            ["browser-focus", "focusAtom"],
            ["browser-visibility", "visibilityAtom"],
        ] as const) {
            const source = read(
                ROOT,
                "packages/@valdres",
                dir,
                "src/atoms",
                `${atom}.ts`,
            )
            expect(source).toContain("externalAtom(")
        }
    })

    test("presence composes the two packages instead of owning a source", () => {
        const directory = join(ROOT, "packages/@valdres/browser-presence")
        const manifest = JSON.parse(read(directory, "package.json"))
        expect(Object.keys(manifest.dependencies ?? {}).sort()).toEqual([
            "@valdres/browser-focus",
            "@valdres/browser-visibility",
        ])
        for (const path of sourceFiles(join(directory, "src"))) {
            const source = readFileSync(path, "utf8")
            expect(source).not.toContain("externalAtom")
            expect(source).not.toContain("addEventListener")
            expect(source).not.toMatch(/\bdocument\.|\bwindow\./)
        }
        const selector = read(directory, "src/selectors/presenceSelector.ts")
        expect(selector).toContain('from "@valdres/browser-focus"')
        expect(selector).toContain('from "@valdres/browser-visibility"')
    })

    test("has a CI job that gates publish", () => {
        const workflow = read(ROOT, ".github", "workflows", "ci.yaml")
        expect(workflow).toMatch(/^    browser-status:\n/m)
        const needs = workflow.match(
            /^    publish:[\s\S]*?\n        needs: \[([^\]]*)\]/m,
        )
        expect(needs).not.toBeNull()
        expect(needs![1]!.split(",").map(job => job.trim())).toContain(
            "browser-status",
        )
    })

    test("the peer floor excludes cores without externalAtom", () => {
        const range = BROWSER_STATUS_CORE_PEER_RANGE
        expect(Bun.semver.satisfies("1.0.0-beta.39", range)).toBe(true)
        expect(Bun.semver.satisfies("1.0.0", range)).toBe(true)
        expect(Bun.semver.satisfies("1.0.0-beta.38", range)).toBe(false)
        expect(Bun.semver.satisfies("1.0.0-beta.19", range)).toBe(false)
        expect(Bun.semver.satisfies("2.0.0", range)).toBe(false)
    })

    test("the packed gate executes the declared floor itself", () => {
        // The gate installs this published pair; it must be the range's floor,
        // or a passing gate would prove a different claim than the manifests make.
        expect(`^${BROWSER_STATUS_FLOOR.valdres}`).toBe(BROWSER_STATUS_CORE_PEER_RANGE)
    })
})
