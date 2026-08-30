/**
 * Guard: `bun test` from the monorepo root is unsupported by default.
 *
 * Bun's test runner ignores the root `package.json` "test" script and, given
 * no path, recursively discovers every `*.test.ts` across all packages and
 * runs them from the root cwd. Each package's tests expect their own cwd
 * (relative bunfig `preload`s, happy-DOM setup, workspace resolution), so a
 * root-level sweep fabricates ~200+ bogus failures that look real.
 *
 * This file is wired as the root bunfig `[test].preload`. Bun does NOT walk up
 * the directory tree for `bunfig.toml` (verified), so it loads ONLY when the
 * cwd is the repo root — never for a per-package `cd packages/<pkg> && bun
 * test`, and never for `bun --filter '*' test`, which runs each package's own
 * "test" script from that package's directory.
 *
 * We cannot tell a bare `bun test` from the one legitimate root invocation,
 * `bun test scripts/` (CI tests the non-package `scripts/` dir the `--filter`
 * sweep never reaches): the preload runs once with argv already rewritten to
 * the first discovered file — a `scripts/` file in both cases — so there is no
 * signal to key off. Instead, ANY root-cwd `bun test` must opt in via
 * VALDRES_ALLOW_ROOT_BUN_TEST=1; CI sets it on the `bun test scripts/` step.
 * Everything else is caught, which is the point.
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

if (isMonorepoRoot && process.env.VALDRES_ALLOW_ROOT_BUN_TEST !== "1") {
    // The preload runs once, before any test file — exit immediately for a
    // single, clean failure instead of letting the bogus sweep run.
    console.error(
        [
            "",
            "  ✗ `bun test` from the monorepo root is not supported — it scans every",
            "    package from the wrong cwd and fabricates bogus failures.",
            "",
            "    Run tests per-package:",
            "        cd packages/valdres && bun test",
            "    or run a root-owned lane:",
            "        bun run test          # certified v1 core + React cohort",
            "        bun run test:all      # all packages (legacy maintenance)",
            "",
            "    (The only root-level exception is the scripts/ tests, which CI runs",
            "     as `VALDRES_ALLOW_ROOT_BUN_TEST=1 bun test scripts/`.)",
            "",
        ].join("\n"),
    )
    process.exit(1)
}
