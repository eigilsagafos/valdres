import { expect, test } from "bun:test"
import { afterEach } from "bun:test"
import { mkdir, mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { readPublicPackages, REPO_ROOT } from "./public-packages"

const temporaryDirs: string[] = []

async function workspace(
    workspaces: string[],
    manifests: Record<string, Record<string, unknown>>,
) {
    const dir = await mkdtemp(join(tmpdir(), "public-packages-"))
    temporaryDirs.push(dir)
    await Bun.write(
        join(dir, "package.json"),
        JSON.stringify({ name: "root", private: true, workspaces }),
    )
    for (const [path, manifest] of Object.entries(manifests)) {
        await mkdir(join(dir, path), { recursive: true })
        await Bun.write(
            join(dir, path, "package.json"),
            JSON.stringify(manifest),
        )
    }
    return dir
}

afterEach(async () => {
    await Promise.all(
        temporaryDirs
            .splice(0)
            .map(dir => rm(dir, { recursive: true, force: true })),
    )
})

test("collects every non-private package across all workspace globs", async () => {
    const dir = await workspace(["packages/*", "packages/@scope/*"], {
        "packages/alpha": { name: "alpha", version: "1.0.0" },
        "packages/@scope/beta": { name: "@scope/beta", version: "2.0.0" },
    })

    expect(await readPublicPackages(dir)).toEqual([
        { dir: "packages/@scope/beta", name: "@scope/beta", version: "2.0.0" },
        { dir: "packages/alpha", name: "alpha", version: "1.0.0" },
    ])
})

test("excludes private packages", async () => {
    const dir = await workspace(["packages/*"], {
        "packages/alpha": { name: "alpha", version: "1.0.0" },
        "packages/internal": {
            name: "internal",
            version: "1.0.0",
            private: true,
        },
    })

    const packages = await readPublicPackages(dir)
    expect(packages.map(pkg => pkg.name)).toEqual(["alpha"])
})

test("rejects a publishable package with no name or version", async () => {
    const dir = await workspace(["packages/*"], {
        "packages/alpha": { version: "1.0.0" },
    })

    expect(readPublicPackages(dir)).rejects.toThrow(
        /must declare a name and a version/,
    )
})

test("rejects a root manifest without workspaces", async () => {
    const dir = await mkdtemp(join(tmpdir(), "public-packages-"))
    temporaryDirs.push(dir)
    await Bun.write(
        join(dir, "package.json"),
        JSON.stringify({ name: "root", private: true }),
    )

    expect(readPublicPackages(dir)).rejects.toThrow(/no workspaces/)
})

test("the real workspace resolves the packages the release actually ships", async () => {
    const packages = await readPublicPackages(REPO_ROOT)

    // A floor, not an exact count: adding a package should not fail this test,
    // but silently resolving a truncated set should.
    expect(packages.length).toBeGreaterThanOrEqual(33)
    expect(packages.map(pkg => pkg.name)).toContain("valdres")
    expect(packages.map(pkg => pkg.name)).toContain(
        "@valdres/browser-geolocation",
    )
    // packages/test is private and must never reach npm.
    expect(packages.map(pkg => pkg.name)).not.toContain("@valdres/test")

    for (const pkg of packages) {
        expect(
            await Bun.file(`${REPO_ROOT}/${pkg.dir}/package.json`).exists(),
        ).toBe(true)
    }
})
