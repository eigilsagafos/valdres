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
    HOTKEYS_EXCLUDED_PEER_VERSIONS,
    HOTKEYS_PACKAGES,
    HOTKEYS_PEER_RANGES,
} from "./lib/hotkeys-packages"
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

const frontMatterNames = (file: string): string[] => {
    const match = readFileSync(file, "utf8").match(/^---\n([\s\S]*?)\n---/)
    if (match === null) return []
    return [...match[1]!.matchAll(/^"([^"]+)":/gm)].map(entry => entry[1]!)
}

describe("hotkeys lane", () => {
    test.each(HOTKEYS_PACKAGES)(
        "$name has the wiring the gates assume",
        pkg => {
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

    test("carries its release notes in exactly one pending breaking changeset", () => {
        const names = HOTKEYS_PACKAGES.map(pkg => pkg.name) as string[]
        const naming = changesetFiles().filter(file =>
            frontMatterNames(file).some(name => names.includes(name)),
        )
        expect(naming.map(file => file.slice(ROOT.length + 1))).toEqual([
            ".changeset/hotkeys-v1-dispatcher.md",
        ])
        const front = read(ROOT, ".changeset/hotkeys-v1-dispatcher.md").match(
            /^---\n([\s\S]*?)\n---/,
        )![1]!
        expect(front).toContain('"@valdres/hotkeys": major')
        expect(front).toContain('"@valdres-react/hotkeys": major')
    })
})
