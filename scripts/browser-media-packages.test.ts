/**
 * Guards the one list that decides which browser packages the media gates claim
 * to cover. Picked up by CI's existing `bun test scripts/` step.
 *
 * The risk this exists for: a future lane adds an entry to
 * `lib/browser-media-packages.ts` for a package that has not actually been
 * migrated, and every downstream gate starts reporting green coverage for a
 * package that still imports the removed `globalAtom`. Or the reverse — a
 * package is migrated and the gate metadata drifts from its real server seed.
 */
import { describe, expect, test } from "bun:test"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import {
    BROWSER_MEDIA_CORE_PEER_RANGE,
    BROWSER_MEDIA_PACKAGES,
    browserMediaPackageNames,
} from "./lib/browser-media-packages"

const ROOT = join(import.meta.dir, "..")
const packageDirectory = (dir: string) =>
    join(ROOT, "packages", "@valdres", dir)
const read = (...parts: string[]) => readFileSync(join(...parts), "utf8")

describe("browser media package list", () => {
    test("is non-empty, unique and covers only real packages", () => {
        expect(BROWSER_MEDIA_PACKAGES.length).toBeGreaterThan(0)
        const dirs = BROWSER_MEDIA_PACKAGES.map(media => media.dir)
        expect(new Set(dirs).size).toBe(dirs.length)
        for (const dir of dirs) {
            expect(existsSync(packageDirectory(dir))).toBe(true)
        }
    })

    test("never silently widens to unmigrated browser packages", () => {
        const all = readdirSync(join(ROOT, "packages", "@valdres")).filter(
            entry => entry.startsWith("browser-"),
        )
        const listed = new Set(BROWSER_MEDIA_PACKAGES.map(media => media.dir))
        // Sanity: the cohort is a strict subset. If this ever becomes equality,
        // the remaining lanes have landed and the claim should be re-examined
        // deliberately rather than by a wildcard.
        expect([...listed].every(dir => all.includes(dir))).toBe(true)
        expect(listed.size).toBeLessThanOrEqual(all.length)
    })

    for (const media of BROWSER_MEDIA_PACKAGES) {
        describe(media.dir, () => {
            const directory = packageDirectory(media.dir)

            test("is a publishable package with the wiring the gates assume", () => {
                const manifest = JSON.parse(read(directory, "package.json"))
                expect(manifest.name).toBe(`@valdres/${media.dir}`)
                expect(manifest.private).toBeUndefined()
                for (const script of [
                    "build",
                    "build:types",
                    "test",
                    "test:ci",
                    "typecheck:tests",
                ]) {
                    expect(manifest.scripts?.[script]).toBeString()
                }
                expect(
                    manifest.scripts["typecheck:tests"],
                ).toContain("tsconfig.tests.json")
                expect(existsSync(join(directory, "tsconfig.tests.json"))).toBe(
                    true,
                )
                // Equality, not existence: the packed gate only checks that the
                // packed core satisfies whatever range is declared, and
                // beta.39 satisfies the pre-migration ^1.0.0-beta.19 too, so
                // existence alone would let the floor regress unnoticed.
                expect(manifest.peerDependencies?.valdres).toBe(
                    BROWSER_MEDIA_CORE_PEER_RANGE,
                )
            })

            test("is actually migrated off globalAtom", () => {
                const sources: string[] = []
                const walk = (dir: string) => {
                    for (const entry of readdirSync(dir, {
                        withFileTypes: true,
                    })) {
                        const path = join(dir, entry.name)
                        if (entry.isDirectory()) walk(path)
                        else if (entry.name.endsWith(".ts")) sources.push(path)
                    }
                }
                walk(join(directory, "src"))
                expect(sources.length).toBeGreaterThan(0)
                for (const path of sources) {
                    expect(readFileSync(path, "utf8")).not.toContain(
                        "globalAtom",
                    )
                }
                const atomModule = readdirSync(
                    join(directory, "src", "atoms"),
                ).find(entry => entry.endsWith("Atom.ts"))
                expect(atomModule).toBeString()
                expect(read(directory, "src", "atoms", atomModule!)).toContain(
                    "externalAtom",
                )
            })

            test("exports the names the gates import", () => {
                const barrel = read(directory, "src", "index.ts")
                expect(barrel).toContain(media.atom)
                expect(barrel).toContain(media.selector)
            })

            test("gate metadata matches the source's documented seed", () => {
                const libDir = join(directory, "src", "lib")
                const sourceFile = readdirSync(libDir).find(entry =>
                    entry.endsWith("Source.ts"),
                )
                expect(sourceFile).toBeString()
                const source = read(libDir, sourceFile!)
                // The unavailable value is both the DOM-less fallback and the
                // deterministic getServerSnapshot seed; the gates assert it.
                expect(source).toContain(`= "${media.unavailable}"`)
                expect(source).toContain(media.query)
            })

            test("remains release-ignored — testing is not publishing", () => {
                const changesets = JSON.parse(
                    read(ROOT, ".changeset", "config.json"),
                )
                expect(changesets.ignore).toContain(`@valdres/${media.dir}`)
            })
        })
    }

    test("the declared peer floor actually excludes pre-externalAtom cores", () => {
        // Guards the constant itself: loosening it back towards beta.19 would
        // otherwise satisfy the equality assertion above by construction.
        expect(Bun.semver.satisfies("1.0.0-beta.39", BROWSER_MEDIA_CORE_PEER_RANGE)).toBe(true)
        expect(Bun.semver.satisfies("1.0.0-beta.40", BROWSER_MEDIA_CORE_PEER_RANGE)).toBe(true)
        expect(Bun.semver.satisfies("1.0.0", BROWSER_MEDIA_CORE_PEER_RANGE)).toBe(true)
        // The release that still lacked `externalAtom`.
        expect(Bun.semver.satisfies("1.0.0-beta.38", BROWSER_MEDIA_CORE_PEER_RANGE)).toBe(false)
        expect(Bun.semver.satisfies("1.0.0-beta.19", BROWSER_MEDIA_CORE_PEER_RANGE)).toBe(false)
        expect(Bun.semver.satisfies("2.0.0", BROWSER_MEDIA_CORE_PEER_RANGE)).toBe(false)
    })

    test("exposes scoped npm names in list order", () => {
        expect(browserMediaPackageNames()).toEqual(
            BROWSER_MEDIA_PACKAGES.map(media => `@valdres/${media.dir}`),
        )
    })
})
