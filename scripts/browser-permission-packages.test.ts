/**
 * Guards the browser-permission lane's metadata and release state. Picked up
 * by CI's existing `bun test scripts/` step.
 *
 * All four packages are migrated but release-ignored: on the Changesets ignore
 * list, off the publishable list, tested by ci.yaml's `browser-permission`
 * job (which `bun run verify` runs) and absent from `publish.needs`. Each
 * package's `releaseEligible` flag is the single claim checked here, so a
 * package cannot drift into a half-enabled state.
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

    test("verify runs the job, but publish does not wait on it", () => {
        expect(read(ROOT, "scripts", "verify.ts")).toMatch(
            /const JOBS = \[[^\]]*"browser-permission"/,
        )
        const needs = ciYaml().match(
            /^    publish:[\s\S]*?\n        needs: \[([^\]]*)\]/m,
        )
        expect(needs).not.toBeNull()
        const gating = needs![1]!.split(",").map(job => job.trim())
        // Release-ignored packages must not gate a release; add the job here
        // only together with release enablement.
        expect(gating).not.toContain("browser-permission")
        expect(BROWSER_PERMISSION_PACKAGES.some(pkg => pkg.releaseEligible)).toBe(false)
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
                // Version Packages owns versions; this lane never bumps them.
                expect(manifest.version).toBe(BROWSER_PERMISSION_LEGACY_VERSION)
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
