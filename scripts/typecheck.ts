/**
 * Repo-wide type-check gate.
 *
 * Runs `tsgo --noEmit -p tsconfig.json` in every publishable package, purely to
 * type-check (no declaration emit). Its main job today is to enforce the
 * `noUnusedLocals` flag set in the root `tsconfig.json`, so unused imports and
 * locals cannot accumulate again — but it catches any type error in a package's
 * public source graph, not just unused symbols.
 *
 * Scope mirrors the `build:types` step exactly: each package is type-checked
 * through its own `tsconfig.json` (the config that already resolves its
 * dependencies correctly), and dependencies resolve through their built
 * `dist/types`. Run `bun run build` + `bun run build:types` first so those
 * artifacts exist — CI does this before invoking the gate.
 *
 * A package is checked when it declares a `build:types` script. Two categories
 * are deliberately skipped, matching the reality of the repo:
 *
 *   - `@valdres-react/panable` and `@valdres-react/draggable` build their types
 *     with `tsgo --noCheck` because their source has pre-existing type errors
 *     unrelated to unused symbols. Type-checking them here would fail on those,
 *     so they are skipped (detected by `--noCheck` in their `build:types`).
 *     Their unused imports were still cleaned up by hand; they just aren't
 *     guarded going forward until those packages are made type-clean.
 *   - `valdres-svelte` has no `build:types` step; it is type-checked by its own
 *     `lint:publish` (svelte-check) gate, which the CI workflow runs separately.
 *
 * Packages run concurrently — nothing is emitted, so the reads of the shared
 * `dist/types` are safe.
 */
import { readdir } from "node:fs/promises"
import { join } from "node:path"

const root = join(import.meta.dir, "..")

const workspaceGlobs = ["packages", "packages/@valdres", "packages/@valdres-react"]

type Pkg = { name: string; dir: string }

const discoverPackages = async (): Promise<Pkg[]> => {
    const pkgs: Pkg[] = []
    for (const glob of workspaceGlobs) {
        const base = join(root, glob)
        let entries: string[]
        try {
            entries = await readdir(base)
        } catch {
            continue
        }
        for (const entry of entries) {
            if (entry.startsWith("@")) continue // scope dir, handled by its own glob
            const dir = join(base, entry)
            const pkgJsonPath = join(dir, "package.json")
            const pkgJsonFile = Bun.file(pkgJsonPath)
            if (!(await pkgJsonFile.exists())) continue
            const pkgJson = await pkgJsonFile.json()
            const buildTypes: string | undefined = pkgJson.scripts?.["build:types"]
            if (!buildTypes) continue // e.g. valdres-svelte — own svelte-check gate
            if (buildTypes.includes("--noCheck")) continue // pre-existing type errors
            if (!(await Bun.file(join(dir, "tsconfig.json")).exists())) continue
            pkgs.push({ name: pkgJson.name ?? entry, dir })
        }
    }
    return pkgs.sort((a, b) => a.name.localeCompare(b.name))
}

const typecheck = (pkg: Pkg) =>
    new Promise<{ pkg: Pkg; ok: boolean; output: string }>(resolve => {
        const proc = Bun.spawn(["bunx", "tsgo", "--noEmit", "-p", "tsconfig.json"], {
            cwd: pkg.dir,
            stdout: "pipe",
            stderr: "pipe",
        })
        Promise.all([
            new Response(proc.stdout).text(),
            new Response(proc.stderr).text(),
            proc.exited,
        ]).then(([out, err, code]) => {
            resolve({ pkg, ok: code === 0, output: (out + err).trim() })
        })
    })

const packages = await discoverPackages()
console.log(`Type-checking ${packages.length} packages…`)

const results = await Promise.all(packages.map(typecheck))

let failed = 0
for (const { pkg, ok, output } of results) {
    if (ok) {
        console.log(`  ✓ ${pkg.name}`)
    } else {
        failed++
        console.log(`  ✗ ${pkg.name}`)
        if (output) console.log(output.replace(/^/gm, "      "))
    }
}

if (failed > 0) {
    console.error(`\n${failed} package(s) failed type-checking.`)
    process.exit(1)
}
console.log("\nAll packages type-check cleanly.")
