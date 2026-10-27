/**
 * Guards the browser-geometry lane's metadata and release state. Picked up by
 * CI's existing `bun test scripts/` step.
 *
 * Both packages are release-eligible: off the Changesets ignore list, on the
 * publishable list, tested by ci.yaml's `browser-geometry` job (which
 * `bun run verify` runs) and in `publish.needs`. Each package's
 * `releaseEligible` flag is the single claim checked here, so a package cannot
 * drift into a half-enabled state. The breaking release note is followed by id
 * through its pending and consumed states (see "the release note").
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
import { BROWSER_PERMISSION_PACKAGES } from "./lib/browser-permission-packages"
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

    test("stays out of the other browser lanes", () => {
        const other = [
            ...BROWSER_MEDIA_PACKAGES.map(pkg => `@valdres/${pkg.dir}`),
            ...BROWSER_STATUS_PACKAGES.map(pkg => pkg.name),
            ...BROWSER_PERMISSION_PACKAGES.map(pkg => pkg.name),
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

            test("release eligibility is the same in both halves of the pipeline", () => {
                const release = BROWSER_GEOMETRY_PACKAGES.find(
                    pkg => pkg.name === name,
                )!.releaseEligible
                expect(release).toBe(true)
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

            test("Version Packages only ever moves the version past the legacy build", () => {
                const manifest = JSON.parse(read(directory, "package.json"))
                expect(
                    Bun.semver.order(
                        manifest.version,
                        BROWSER_GEOMETRY_LEGACY_VERSION,
                    ),
                ).toBeGreaterThanOrEqual(0)
            })
        })
    }

    test("its CI job gates publish exactly when the packages release", () => {
        const workflow = read(ROOT, ".github", "workflows", "ci.yaml")
        expect(workflow).toMatch(/^    browser-geometry:\n/m)
        expect(read(ROOT, "scripts", "verify.ts")).toMatch(
            /const JOBS = \[[^\]]*"browser-geometry"/,
        )
        const needs = workflow.match(
            /^    publish:[\s\S]*?\n        needs: \[([^\]]*)\]/m,
        )
        expect(needs).not.toBeNull()
        const gating = needs![1]!.split(",").map(job => job.trim())
        const eligible = BROWSER_GEOMETRY_PACKAGES.some(
            pkg => pkg.releaseEligible,
        )
        expect(gating.includes("browser-geometry")).toBe(eligible)
    })

    test("its CI job runs on the repository's pinned toolchain", () => {
        const workflow = read(ROOT, ".github", "workflows", "ci.yaml")
        const job = workflow.match(
            /^    browser-geometry:\n([\s\S]*?)(?=^    [a-z-]+:\n)/m,
        )
        expect(job).not.toBeNull()
        const bun = job![1]!.match(/bun-version: (\S+)/)?.[1]
        const node = job![1]!.match(/node-version: "([^"]+)"/)?.[1]
        expect(bun).toBe(read(ROOT, ".bun-version").trim())
        const pinnedNode = workflow.match(
            /^    test:\n[\s\S]*?node-version: "([^"]+)"/m,
        )?.[1]
        expect(node).toBe(pinnedNode)
        expect(job![1]).toContain("run: bun run test:browser-geometry\n")
        expect(job![1]).toContain("run: bun run test:browser-geometry:packed")
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

// ── the release note ───────────────────────────────────────────────────────
// The breaking notes ship in one changeset, followed by id: pending as
// `.changeset/<id>.md`, consumed (moved by Version Packages) as
// `.changeset/pre/<id>.md`. After the prerelease exits, the stable
// `changeset version` deletes consumed notes; the CHANGELOG entries are the
// durable record from then on, so the note is only required while the
// packages are on the 1.0.0 prerelease line.
const NOTE_ID = "browser-geometry-release"
const NOTE_MARKER =
    "**Breaking: the window size and screen are now read-only browser state, published as one frozen snapshot each.**"
const NOTE_REQUIRED_TEXT = [
    NOTE_MARKER,
    "`setSelf` / `resetSelf` are gone",
    "equal-valued new object",
    "animation frames 2 to 4",
    "No timer polls",
    "`ScreenOrientationType`",
    "`MediaQueryList.addListener`",
    BROWSER_GEOMETRY_CORE_PEER_RANGE,
    // The three deferred-changeset fixes these packages now receive.
    "`.js` import specifiers",
    "`require(esm)`",
    "`workspace:` protocol",
]
const squash = (text: string) => text.replace(/\s+/g, " ")

describe("the release note", () => {
    const manifests = BROWSER_GEOMETRY_PACKAGES.map(pkg => ({
        ...pkg,
        manifest: JSON.parse(read(ROOT, pkg.dir, "package.json")),
    }))
    const onPrereleaseLine = manifests.some(({ manifest }) =>
        String(manifest.version).startsWith("1.0.0-"),
    )
    const copies = [
        join(ROOT, ".changeset", `${NOTE_ID}.md`),
        join(ROOT, ".changeset", "pre", `${NOTE_ID}.md`),
    ].filter(existsSync)

    test("exists exactly once while the packages are on the prerelease line", () => {
        if (!onPrereleaseLine) return
        expect(copies).toHaveLength(1)
    })

    test("names exactly these packages and makes every required claim", () => {
        for (const file of copies) {
            const parsed = parseChangeset(readFileSync(file, "utf8"))
            expect(parsed.releases.map(release => release.name).sort()).toEqual(
                [...names].sort(),
            )
            for (const text of NOTE_REQUIRED_TEXT)
                expect({
                    text,
                    present: squash(parsed.summary).includes(squash(text)),
                }).toEqual({ text, present: true })
        }
    })

    test("no other changeset carries the note or keeps a deferred entry for these packages", () => {
        for (const file of changesetFiles()) {
            if (copies.includes(file)) continue
            const contents = readFileSync(file, "utf8")
            expect({
                file,
                duplicate: squash(contents).includes(squash(NOTE_MARKER)),
            }).toEqual({ file, duplicate: false })
            if (file.endsWith("-deferred.md"))
                expect({
                    file,
                    named: frontMatterNames(file).filter(name =>
                        names.includes(name),
                    ),
                }).toEqual({ file, named: [] })
        }
    })

    test("once consumed, each package's CHANGELOG carries the note exactly once", () => {
        const consumed = copies.some(file =>
            file.endsWith(join("pre", `${NOTE_ID}.md`)),
        )
        for (const { dir, manifest } of manifests) {
            const changelog = squash(read(ROOT, dir, "CHANGELOG.md"))
            const count = changelog.split(squash(NOTE_MARKER)).length - 1
            expect({ name: manifest.name, count }).toEqual({
                name: manifest.name,
                count: consumed || !onPrereleaseLine ? 1 : 0,
            })
        }
    })
})
