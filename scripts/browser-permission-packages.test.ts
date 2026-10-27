/**
 * Guards the browser-permission lane's metadata and release state. Picked up
 * by CI's existing `bun test scripts/` step.
 *
 * All four packages are release-eligible: off the Changesets ignore list, on
 * the publishable list, tested by ci.yaml's `browser-permission` job (which
 * `bun run verify` runs) and in `publish.needs`. Each package's
 * `releaseEligible` flag is the single claim checked here, so a package cannot
 * drift into a half-enabled state. The breaking release note is followed by id
 * through its pending and consumed states (see "the release note").
 */
import { describe, expect, test } from "bun:test"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import {
    BROWSER_PERMISSION_CORE_PEER_RANGE,
    BROWSER_PERMISSION_FLOOR,
    BROWSER_PERMISSION_LEGACY_VERSION,
    BROWSER_PERMISSION_PACKAGES,
} from "./lib/browser-permission-packages"
import { BROWSER_MEDIA_PACKAGES } from "./lib/browser-media-packages"
import { BROWSER_STATUS_PACKAGES } from "./lib/browser-status-packages"
import { PUBLISHABLE_PACKAGE_DIRS } from "./lib/publishable-packages"
import { loadChangesetParser } from "./lib/browser-status-release-note"

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

const names = BROWSER_PERMISSION_PACKAGES.map(pkg => pkg.name) as string[]
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

describe("browser-permission lane", () => {
    test("is unique and covers only real packages", () => {
        expect(new Set(names).size).toBe(names.length)
        for (const { dir, name } of BROWSER_PERMISSION_PACKAGES) {
            const manifest = JSON.parse(read(ROOT, dir, "package.json"))
            expect(manifest.name).toBe(name)
        }
    })

    test("stays out of the other lanes", () => {
        const other = [
            ...BROWSER_MEDIA_PACKAGES.map(pkg => `@valdres/${pkg.dir}`),
            ...BROWSER_STATUS_PACKAGES.map(pkg => pkg.name),
        ]
        for (const name of names) expect(other).not.toContain(name)
    })

    test("the floor pair satisfies the declared peer range", () => {
        expect(Bun.semver.satisfies(BROWSER_PERMISSION_FLOOR.valdres, BROWSER_PERMISSION_CORE_PEER_RANGE)).toBe(true)
        expect(Bun.semver.satisfies("1.0.0-beta.38", BROWSER_PERMISSION_CORE_PEER_RANGE)).toBe(false)
    })

    test("its ci.yaml job runs both gates through the root scripts", () => {
        const job = ciJob("browser-permission")
        expect(job).toBeString()
        expect(job).toContain("run: bun run test:browser-permission\n")
        expect(job).toContain("run: bun run test:browser-permission:packed\n")
        const scripts = JSON.parse(read(ROOT, "package.json")).scripts
        expect(scripts["test:browser-permission"]).toBe(
            "bun run scripts/check-browser-permission.ts",
        )
        expect(scripts["test:browser-permission:packed"]).toBe(
            "bun run scripts/test-browser-permission-packed-consumer.ts",
        )
        // One execution path: the lane's former standalone workflow is gone.
        expect(
            existsSync(join(ROOT, ".github", "workflows", "browser-permission.yaml")),
        ).toBe(false)
    })

    test("verify runs the job, and publish waits on it exactly when the packages release", () => {
        expect(read(ROOT, "scripts", "verify.ts")).toMatch(
            /const JOBS = \[[^\]]*"browser-permission"/,
        )
        const needs = ciYaml().match(
            /^    publish:[\s\S]*?\n        needs: \[([^\]]*)\]/m,
        )
        expect(needs).not.toBeNull()
        const gating = needs![1]!.split(",").map(job => job.trim())
        // The revision that publishes these packages must have passed their
        // gates; release-ignored packages must not gate a release.
        const eligible = BROWSER_PERMISSION_PACKAGES.some(pkg => pkg.releaseEligible)
        expect(gating.includes("browser-permission")).toBe(eligible)
    })

    for (const pkg of BROWSER_PERMISSION_PACKAGES) {
        describe(pkg.name, () => {
            const directory = join(ROOT, pkg.dir)

            test("has the wiring the gates assume and the exact peer floor", () => {
                const manifest = JSON.parse(read(directory, "package.json"))
                expect(manifest.private).toBeUndefined()
                for (const script of ["build", "build:types", "test", "test:ci", "typecheck:tests"])
                    expect(manifest.scripts?.[script]).toBeString()
                expect(manifest.scripts["typecheck:tests"]).toContain("tsconfig.tests.json")
                expect(existsSync(join(directory, "tsconfig.tests.json"))).toBe(true)
                expect(manifest.peerDependencies).toEqual({
                    valdres: BROWSER_PERMISSION_CORE_PEER_RANGE,
                })
                expect(manifest.dependencies).toBeUndefined()
                // Version Packages owns versions; it only ever moves them past
                // the legacy build.
                expect(Bun.semver.order(manifest.version, BROWSER_PERMISSION_LEGACY_VERSION)).toBeGreaterThanOrEqual(0)
            })

            test("is migrated off the removed globals", () => {
                for (const file of sourceFiles(join(directory, "src"))) {
                    const source = readFileSync(file, "utf8")
                    expect({ file, globalAtom: source.includes("globalAtom") }).toEqual({ file, globalAtom: false })
                    expect({ file, globalStore: source.includes("globalStore") }).toEqual({ file, globalStore: false })
                    expect({ file, setSelf: source.includes("setSelf") }).toEqual({ file, setSelf: false })
                }
            })

            test("release state matches its releaseEligible claim", () => {
                const isIgnored = ignored().includes(pkg.name)
                const isPublishable = PUBLISHABLE_PACKAGE_DIRS.includes(pkg.dir)
                expect({ isIgnored, isPublishable }).toEqual({
                    isIgnored: !pkg.releaseEligible,
                    isPublishable: pkg.releaseEligible,
                })
            })
        })
    }
})

// ── the release note ───────────────────────────────────────────────────────
// The breaking notes ship in one changeset, followed by id: pending as
// `.changeset/<id>.md`, consumed (moved by Version Packages) as
// `.changeset/pre/<id>.md`. After the prerelease exits, the stable
// `changeset version` deletes consumed notes; the CHANGELOG entries are the
// durable record from then on, so the note is only required while the
// packages are on the 1.0.0 prerelease line.
const NOTE_ID = "browser-permission-release"
const NOTE_MARKER =
    "**Breaking: motion, orientation, geolocation and screen details are now read-only browser state with explicit permission triggers.**"
const NOTE_REQUIRED_TEXT = [
    NOTE_MARKER,
    "watchGeolocation(store, options?)",
    "geolocationOptionsAtom",
    "GeolocationWatchConflictError",
    "globalThis.reportError",
    "never retried",
    "may be stale",
    "Known limitation",
    BROWSER_PERMISSION_CORE_PEER_RANGE,
    // The three deferred-changeset fixes these packages now receive.
    "`.js` import specifiers",
    "`require(esm)`",
    "`workspace:` protocol",
]
const squash = (text: string) => text.replace(/\s+/g, " ")
const changesetFiles = (dir = join(ROOT, ".changeset")): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const path = join(dir, entry.name)
        if (entry.isDirectory()) return changesetFiles(path)
        return entry.name.endsWith(".md") && entry.name !== "README.md" ? [path] : []
    })
const parseChangeset = await loadChangesetParser(ROOT)

describe("the release note", () => {
    const manifests = BROWSER_PERMISSION_PACKAGES.map(pkg => ({
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
            expect(parsed.releases.map(release => release.name).sort()).toEqual([...names].sort())
            for (const text of NOTE_REQUIRED_TEXT)
                expect({ text, present: squash(parsed.summary).includes(squash(text)) }).toEqual({
                    text,
                    present: true,
                })
        }
    })

    test("no other changeset carries the note or keeps a deferred entry for these packages", () => {
        for (const file of changesetFiles()) {
            if (copies.includes(file)) continue
            const contents = readFileSync(file, "utf8")
            expect({ file, duplicate: squash(contents).includes(squash(NOTE_MARKER)) }).toEqual({
                file,
                duplicate: false,
            })
            if (file.endsWith("-deferred.md")) {
                const named = parseChangeset(contents).releases.map(release => release.name)
                expect({ file, named: named.filter(name => names.includes(name)) }).toEqual({
                    file,
                    named: [],
                })
            }
        }
    })

    test("once consumed, each package's CHANGELOG carries the note exactly once", () => {
        const consumed = copies.some(file => file.includes(`${join("pre", NOTE_ID)}.md`))
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
