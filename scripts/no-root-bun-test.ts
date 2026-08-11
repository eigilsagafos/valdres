/**
 * Guard: `bun test` (the built-in runner) at the monorepo root is unsupported.
 *
 * Bun's test runner ignores the root `package.json` "test" script and instead
 * recursively discovers every `*.test.ts` across all packages, running them
 * from the root cwd. Each package's tests expect their own cwd (relative
 * bunfig `preload`s, happy-DOM setup, workspace resolution), so a root run
 * fabricates ~200+ bogus failures that look real.
 *
 * This file is wired as the root bunfig `[test].preload`. Bun does NOT walk up
 * the directory tree for `bunfig.toml` (verified), so this preload loads ONLY
 * when `bun test` is invoked with the repo root as cwd — never for a
 * per-package `cd packages/<pkg> && bun test`, and never for
 * `bun --filter '*' test`, which runs each package's own "test" script from
 * that package's directory. The `workspaces` check is belt-and-suspenders so
 * the guard can only ever fire at the workspace root.
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

let isMonorepoRoot = false
try {
    const pkg = JSON.parse(
        readFileSync(resolve(process.cwd(), "package.json"), "utf8"),
    )
    isMonorepoRoot = Boolean(pkg.workspaces)
} catch {
    // No readable package.json here — not the root we guard against.
}

if (isMonorepoRoot) {
    // A preload runs once per discovered test file, so throwing would repeat
    // the message for all ~240 files. Exit immediately on the first load for a
    // single, clean failure.
    console.error(
        [
            "",
            "  ✗ `bun test` at the monorepo root is not supported — it scans every",
            "    package from the wrong cwd and fabricates bogus failures.",
            "",
            "    Run tests per-package:",
            "        cd packages/valdres && bun test",
            "    or across all packages:",
            "        bun run test          # → bun --filter '*' test",
            "",
        ].join("\n"),
    )
    process.exit(1)
}
