/**
 * Guards the keyboard lane's release and gate wiring. Picked up by CI's
 * existing `bun test scripts/` step.
 *
 * The package is release-eligible, so the three things that must stay true
 * together are checked together: it is migrated (no `globalAtom`), it declares
 * the exact core floor its packed gate asserts, and it sits on the publish list
 * and off the Changesets ignore list, with no changeset mixing it with an
 * ignored package.
 */
import { describe, expect, test } from "bun:test"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import {
    BROWSER_KEYBOARD_CORE_PEER_RANGE,
    BROWSER_KEYBOARD_DIR,
    BROWSER_KEYBOARD_NAME,
} from "./lib/browser-keyboard-package"
import { BROWSER_MEDIA_PACKAGES } from "./lib/browser-media-packages"
import { PUBLISHABLE_PACKAGE_DIRS } from "./lib/publishable-packages"

const ROOT = join(import.meta.dir, "..")
const directory = join(ROOT, BROWSER_KEYBOARD_DIR)
const read = (...parts: string[]) => readFileSync(join(...parts), "utf8")

const sourceFiles = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const path = join(dir, entry.name)
        if (entry.isDirectory()) return sourceFiles(path)
        return entry.name.endsWith(".ts") ? [path] : []
    })

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

describe("@valdres/browser-keyboard lane", () => {
    test("has the wiring the gates assume", () => {
        const manifest = JSON.parse(read(directory, "package.json"))
        expect(manifest.name).toBe(BROWSER_KEYBOARD_NAME)
        expect(manifest.private).toBeUndefined()
        for (const script of [
            "build",
            "build:types",
            "test",
            "typecheck:tests",
        ])
            expect(manifest.scripts?.[script]).toBeString()
        expect(existsSync(join(directory, "tsconfig.tests.json"))).toBe(true)
        expect(manifest.peerDependencies?.valdres).toBe(
            BROWSER_KEYBOARD_CORE_PEER_RANGE,
        )
    })

    test("the peer floor excludes cores without the selector reversal fix", () => {
        const range = BROWSER_KEYBOARD_CORE_PEER_RANGE
        expect(Bun.semver.satisfies("1.0.0-beta.40", range)).toBe(true)
        expect(Bun.semver.satisfies("1.0.0", range)).toBe(true)
        expect(Bun.semver.satisfies("1.0.0-beta.39", range)).toBe(false)
        expect(Bun.semver.satisfies("2.0.0", range)).toBe(false)
    })

    test("is migrated onto the public externalAtom primitive", () => {
        const sources = sourceFiles(join(directory, "src"))
        expect(sources.length).toBeGreaterThan(0)
        for (const path of sources) {
            const source = readFileSync(path, "utf8")
            expect(source).not.toContain("globalAtom")
            expect(source).not.toMatch(/\b(setSelf|getSelf|onMount)\b/)
        }
        expect(read(directory, "src", "atoms", "keyboardAtom.ts")).toContain(
            "externalAtom(",
        )
    })

    test("stays out of the media registry", () => {
        expect(BROWSER_MEDIA_PACKAGES.map(media => media.dir)).not.toContain(
            "browser-keyboard",
        )
    })

    test("is release-eligible in both halves of the pipeline", () => {
        const { ignore } = JSON.parse(read(ROOT, ".changeset", "config.json"))
        expect(ignore).not.toContain(BROWSER_KEYBOARD_NAME)
        expect(PUBLISHABLE_PACKAGE_DIRS).toContain(BROWSER_KEYBOARD_DIR)
    })

    test("gates publish in CI", () => {
        const workflow = read(ROOT, ".github", "workflows", "ci.yaml")
        expect(workflow).toMatch(/^    browser-keyboard:\n/m)
        const needs = workflow.match(
            /^    publish:[\s\S]*?\n        needs: \[([^\]]*)\]/m,
        )
        expect(needs?.[1]?.split(",").map(job => job.trim())).toContain(
            "browser-keyboard",
        )
    })

    test("carries no changeset mixed with an ignored package", () => {
        const { ignore } = JSON.parse(read(ROOT, ".changeset", "config.json"))
        for (const file of changesetFiles()) {
            const names = frontMatterNames(file)
            if (!names.includes(BROWSER_KEYBOARD_NAME)) continue
            const mixedWith = names.filter(name => ignore.includes(name))
            expect({ file, mixedWith }).toEqual({ file, mixedWith: [] })
        }
    })
})
