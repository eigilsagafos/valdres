/**
 * Guards the hotkeys lane's release and gate wiring. Picked up by CI's existing
 * `bun test scripts/` step.
 *
 * Both packages are release-eligible, so these stay true together: they sit on
 * the publish list and off the Changesets ignore list, no changeset (pending
 * or deferred) mixes them with an ignored package, their CI job gates publish,
 * and they declare the exact peer floors that exclude the legacy releases.
 */
import { describe, expect, test } from "bun:test"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import {
    assertHotkeysReleaseCohort,
    assertHotkeysReleaseNotes,
    HOTKEYS_EXCLUDED_PEER_VERSIONS,
    HOTKEYS_PACKAGES,
    HOTKEYS_PEER_RANGES,
    parseChangesetReleases,
    type ChangesetEntry,
} from "./lib/hotkeys-packages"
import { pendingReleaseVersions } from "./lib/pending-release-versions"
import { PUBLISHABLE_PACKAGE_DIRS } from "./lib/publishable-packages"

const ROOT = join(import.meta.dir, "..")
const read = (...parts: string[]) => readFileSync(join(...parts), "utf8")
const ignored: string[] = JSON.parse(
    read(ROOT, ".changeset", "config.json"),
).ignore

const changesetFiles = (dir = join(ROOT, ".changeset")): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const path = join(dir, entry.name)
        if (entry.isDirectory()) return changesetFiles(path)
        return entry.name.endsWith(".md") && entry.name !== "README.md"
            ? [path]
            : []
    })

/** Pending (`.changeset/*.md`) and consumed (`.changeset/pre/*.md`) changesets. */
const repositoryChangesets = (): ChangesetEntry[] =>
    ["", "pre/"].flatMap(sub =>
        readdirSync(join(ROOT, ".changeset", sub))
            .filter(file => file.endsWith(".md") && file !== "README.md")
            .map(file => ({
                path: `.changeset/${sub}${file}`,
                releases: parseChangesetReleases(
                    read(ROOT, ".changeset", sub, file),
                ),
            })),
    )

const frontMatterNames = (file: string): string[] => {
    const match = readFileSync(file, "utf8").match(/^---\n([\s\S]*?)\n---/)
    if (match === null) return []
    return [...match[1]!.matchAll(/^"([^"]+)":/gm)].map(entry => entry[1]!)
}

describe("hotkeys lane", () => {
    test.each([...HOTKEYS_PACKAGES])(
        "$name has the wiring the gates assume",
        (pkg: (typeof HOTKEYS_PACKAGES)[number]) => {
            const directory = join(ROOT, pkg.dir)
            const manifest = JSON.parse(read(directory, "package.json"))
            expect(manifest.name).toBe(pkg.name)
            expect(manifest.private).toBeUndefined()
            expect(manifest.publishConfig?.access).toBe("public")
            for (const script of [
                "build",
                "build:types",
                "test",
                "typecheck:tests",
            ])
                expect(manifest.scripts?.[script]).toBeString()
            expect(existsSync(join(directory, "tsconfig.tests.json"))).toBe(
                true,
            )
            expect(manifest.peerDependencies).toEqual(
                HOTKEYS_PEER_RANGES[pkg.name],
            )
        },
    )

    test("@valdres/hotkeys exports exactly its public entry and the adapter entry", () => {
        const manifest = JSON.parse(
            read(ROOT, "packages/@valdres/hotkeys", "package.json"),
        )
        expect(manifest.exports).toEqual({
            ".": "./src/index.ts",
            "./adapter-internals": "./src/adapter-internals.ts",
        })
    })

    test("peer floors exclude the releases that predate what they need", () => {
        for (const ranges of Object.values(HOTKEYS_PEER_RANGES))
            for (const [peer, range] of Object.entries(ranges)) {
                if (peer === "react") continue
                const excluded =
                    HOTKEYS_EXCLUDED_PEER_VERSIONS[
                        peer as keyof typeof HOTKEYS_EXCLUDED_PEER_VERSIONS
                    ]
                expect({
                    peer,
                    excluded: Bun.semver.satisfies(excluded, range),
                }).toEqual({
                    peer,
                    excluded: false,
                })
                expect(Bun.semver.satisfies("1.0.0", range)).toBe(true)
                expect(Bun.semver.satisfies("2.0.0", range)).toBe(false)
            }
    })

    test("is release-eligible in both halves of the pipeline", () => {
        for (const pkg of HOTKEYS_PACKAGES) {
            expect(ignored).not.toContain(pkg.name)
            expect(PUBLISHABLE_PACKAGE_DIRS).toContain(pkg.dir)
        }
    })

    test("gates publish in CI", () => {
        const workflow = read(ROOT, ".github", "workflows", "ci.yaml")
        expect(workflow).toMatch(/^    hotkeys:\n/m)
        const needs = workflow.match(
            /^    publish:[\s\S]*?\n        needs: \[([^\]]*)\]/m,
        )
        expect(needs?.[1]?.split(",").map(job => job.trim())).toContain(
            "hotkeys",
        )
    })

    test("no changeset, pending or deferred, mixes it with an ignored package", () => {
        const names = HOTKEYS_PACKAGES.map(pkg => pkg.name) as string[]
        for (const file of changesetFiles()) {
            const listed = frontMatterNames(file)
            if (!listed.some(name => names.includes(name))) continue
            const mixedWith = listed.filter(name => ignored.includes(name))
            expect({ file, mixedWith }).toEqual({ file, mixedWith: [] })
        }
    })

    test("carries its breaking release notes in exactly one changeset, pending or consumed", () => {
        const entry = assertHotkeysReleaseNotes(repositoryChangesets())
        expect(entry.path).toMatch(
            /^\.changeset\/(?:pre\/)?hotkeys-v1-dispatcher\.md$/,
        )
    })

    test("both packages release at least the v1 floor, per the actual release plan", () => {
        const manifests = Object.fromEntries(
            HOTKEYS_PACKAGES.map(pkg => [
                pkg.name,
                JSON.parse(read(ROOT, pkg.dir, "package.json")).version,
            ]),
        )
        const versions = assertHotkeysReleaseCohort(
            pendingReleaseVersions(ROOT),
            manifests,
        )
        expect(Object.keys(versions).sort()).toEqual([
            "@valdres-react/hotkeys",
            "@valdres/hotkeys",
        ])
    }, 30_000)
})

describe("hotkeys release-note guard", () => {
    const both = {
        "@valdres/hotkeys": "major",
        "@valdres-react/hotkeys": "major",
    }
    const entry = (path: string, releases: Record<string, string>) => ({
        path,
        releases,
    })

    test("accepts the breaking changeset while pending and once consumed", () => {
        for (const path of [
            ".changeset/hotkeys-v1-dispatcher.md",
            ".changeset/pre/hotkeys-v1-dispatcher.md",
        ])
            expect(
                assertHotkeysReleaseNotes([
                    entry(path, both),
                    entry(".changeset/pre/other.md", { valdres: "major" }),
                    entry(".changeset/hotkeys-fix.md", {
                        "@valdres/hotkeys": "patch",
                    }),
                ]).path,
            ).toBe(path)
    })

    test("rejects a missing breaking changeset", () => {
        expect(() =>
            assertHotkeysReleaseNotes([
                entry(".changeset/hotkeys-fix.md", {
                    "@valdres/hotkeys": "patch",
                    "@valdres-react/hotkeys": "patch",
                }),
            ]),
        ).toThrow("found 0")
    })

    test("rejects duplicated breaking changesets, pending and consumed or two files", () => {
        expect(() =>
            assertHotkeysReleaseNotes([
                entry(".changeset/hotkeys-v1-dispatcher.md", both),
                entry(".changeset/pre/hotkeys-v1-dispatcher.md", both),
            ]),
        ).toThrow("found 2")
        expect(() =>
            assertHotkeysReleaseNotes([
                entry(".changeset/pre/hotkeys-v1-dispatcher.md", both),
                entry(".changeset/hotkeys-again.md", {
                    "@valdres/hotkeys": "major",
                }),
            ]),
        ).toThrow("found 2")
    })

    test("rejects a breaking changeset that does not release both as major", () => {
        expect(() =>
            assertHotkeysReleaseNotes([
                entry(".changeset/pre/hotkeys-v1-dispatcher.md", {
                    "@valdres/hotkeys": "major",
                }),
            ]),
        ).toThrow("@valdres-react/hotkeys as major")
        expect(() =>
            assertHotkeysReleaseNotes([
                entry(".changeset/pre/hotkeys-v1-dispatcher.md", {
                    "@valdres/hotkeys": "major",
                    "@valdres-react/hotkeys": "minor",
                }),
            ]),
        ).toThrow("not minor")
    })

    test("parses front matter like Changesets writes it", () => {
        expect(
            parseChangesetReleases(
                '---\n"@valdres/hotkeys": major\n"@valdres-react/hotkeys": major\n---\n\nNotes',
            ),
        ).toEqual(both)
        expect(parseChangesetReleases("---\n---\n")).toEqual({})
    })
})

describe("hotkeys release-cohort guard", () => {
    const beta7 = {
        "@valdres/hotkeys": "1.0.0-beta.7",
        "@valdres-react/hotkeys": "1.0.0-beta.7",
    }

    test("passes when the plan moves both to the floor or beyond", () => {
        expect(
            assertHotkeysReleaseCohort(
                new Map([
                    ["@valdres/hotkeys", "1.0.0-beta.8"],
                    ["@valdres-react/hotkeys", "1.0.0-beta.8"],
                ]),
                beta7,
            ),
        ).toEqual({
            "@valdres/hotkeys": "1.0.0-beta.8",
            "@valdres-react/hotkeys": "1.0.0-beta.8",
        })
        expect(() =>
            assertHotkeysReleaseCohort(new Map(), {
                "@valdres/hotkeys": "1.0.0-beta.12",
                "@valdres-react/hotkeys": "1.0.0",
            }),
        ).not.toThrow()
    })

    test("rejects a plan omitting React hotkeys while its manifest stays beta.7", () => {
        expect(() =>
            assertHotkeysReleaseCohort(
                new Map([["@valdres/hotkeys", "1.0.0-beta.8"]]),
                beta7,
            ),
        ).toThrow("@valdres-react/hotkeys would release 1.0.0-beta.7")
    })

    test("rejects post-version manifests where React hotkeys stayed beta.7", () => {
        expect(() =>
            assertHotkeysReleaseCohort(new Map(), {
                "@valdres/hotkeys": "1.0.0-beta.8",
                "@valdres-react/hotkeys": "1.0.0-beta.7",
            }),
        ).toThrow("@valdres-react/hotkeys would release 1.0.0-beta.7")
    })

    test("rejects a missing version", () => {
        expect(() =>
            assertHotkeysReleaseCohort(new Map(), {
                "@valdres/hotkeys": "1.0.0-beta.8",
            }),
        ).toThrow("No release or manifest version for @valdres-react/hotkeys")
    })
})
