/**
 * Guards the list the release pipeline walks.
 *
 * The failure this exists to prevent: `changeset publish` publishes every
 * non-ignored, non-private package with an unpublished version, but only
 * packages on `scripts/publishable-packages.json` are prepacked by
 * `scripts/ci-publish.sh`. A package publishable-but-not-listed ships its
 * workspace manifest — `exports` pointing at `./src/index.ts` while `files`
 * ships only `dist` — and every import of that tarball fails. The two lists are
 * therefore asserted to be exact complements.
 */
import { describe, expect, test } from "bun:test"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import {
    PUBLISHABLE_PACKAGE_DIRS,
    expectedPackageName,
    publishablePackageNames,
} from "./lib/publishable-packages"

const ROOT = join(import.meta.dir, "..")
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), "utf8")
const manifestOf = (dir: string) =>
    JSON.parse(read(dir, "package.json")) as {
        name: string
        private?: boolean
        version?: string
        scripts?: Record<string, string>
    }

describe("publishable package list", () => {
    test("is non-empty and free of duplicates", () => {
        expect(PUBLISHABLE_PACKAGE_DIRS.length).toBeGreaterThan(0)
        expect(new Set(PUBLISHABLE_PACKAGE_DIRS).size).toBe(
            PUBLISHABLE_PACKAGE_DIRS.length,
        )
    })

    test("derives scoped and unscoped names from the directory", () => {
        expect(expectedPackageName("packages/valdres")).toBe("valdres")
        expect(expectedPackageName("packages/valdres-react")).toBe(
            "valdres-react",
        )
        expect(
            expectedPackageName("packages/@valdres/browser-color-scheme"),
        ).toBe("@valdres/browser-color-scheme")
        // Plain basename() produced "browser-color-scheme" here, which made the
        // release script abort on the first scoped package — for every package,
        // because the validation loop runs before any prepack.
        expect(
            expectedPackageName("packages/@scope/nested-name"),
        ).toBe("@scope/nested-name")
    })

    for (const dir of PUBLISHABLE_PACKAGE_DIRS) {
        describe(dir, () => {
            test("exists and declares the name its directory implies", () => {
                expect(existsSync(join(ROOT, dir))).toBe(true)
                const manifest = manifestOf(dir)
                expect(manifest.name).toBe(expectedPackageName(dir))
            })

            test("is publishable, buildable and canonically versioned", () => {
                const manifest = manifestOf(dir)
                expect(manifest.private).toBeUndefined()
                // The release build runs these on the publish runner.
                expect(manifest.scripts?.build).toBeString()
                expect(manifest.scripts?.["build:types"]).toBeString()
                // ci-publish.sh rejects anything else before prepacking.
                expect(manifest.version).toMatch(
                    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)-beta\.(0|[1-9]\d*)$/,
                )
            })

            test("is not release-ignored", () => {
                const ignore: string[] = JSON.parse(
                    read(".changeset", "config.json"),
                ).ignore
                expect(ignore).not.toContain(expectedPackageName(dir))
            })
        })
    }

    test("every non-ignored publishable workspace package is on the list", () => {
        const ignore: string[] = JSON.parse(
            read(".changeset", "config.json"),
        ).ignore
        const listed = new Set(publishablePackageNames())
        const { workspaces } = JSON.parse(read("package.json")) as {
            workspaces: string[]
        }
        const missing: string[] = []
        for (const pattern of workspaces) {
            const base = pattern.replace(/\/\*$/, "")
            const glob = new Bun.Glob("*/package.json")
            for (const entry of glob.scanSync({ cwd: join(ROOT, base) })) {
                const dir = join(base, entry).replace(/\/package\.json$/, "")
                // Scope directories are covered by their own workspace pattern.
                if (dir.split("/").pop()!.startsWith("@")) continue
                const manifest = manifestOf(dir)
                if (manifest.private) continue
                if (ignore.includes(manifest.name)) continue
                if (listed.has(manifest.name)) continue
                missing.push(`${manifest.name} (${dir})`)
            }
        }
        // A package here would be published without ever being prepacked.
        expect(missing).toEqual([])
    })
})
