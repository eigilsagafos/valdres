/**
 * Runs the browser-permission packages' suites and BOTH typechecks per
 * package. The publish-facing `tsconfig.json` narrows to `src/index.ts` and
 * `bun test` erases types, so `tsconfig.tests.json` is what holds the
 * `@ts-expect-error` read-only contracts.
 *
 *   bun run scripts/check-browser-permission.ts
 */
import { spawnSync } from "node:child_process"
import { join } from "node:path"
import { BROWSER_PERMISSION_PACKAGES } from "./lib/browser-permission-packages"

const ROOT = join(import.meta.dir, "..")
const TSGO = join(ROOT, "node_modules", ".bin", "tsgo")

const steps = BROWSER_PERMISSION_PACKAGES.flatMap(({ dir }) => [
    {
        dir,
        label: "source typecheck",
        command: [TSGO, "--noEmit", "-p", "tsconfig.json"],
    },
    {
        dir,
        label: "test typecheck (@ts-expect-error contracts)",
        // --singleThreaded: the same tsgo 7.0.0-dev.20260521.1 realpath-race
        // workaround as scripts/check-browser-status.ts.
        command: [TSGO, "--noEmit", "--singleThreaded", "-p", "tsconfig.tests.json"],
    },
    { dir, label: "bun test", command: ["bun", "test"] },
])

const failures: string[] = []
for (const step of steps) {
    const started = performance.now()
    const result = spawnSync(step.command[0]!, step.command.slice(1), {
        cwd: join(ROOT, step.dir),
        encoding: "utf8",
    })
    const elapsed = `${((performance.now() - started) / 1000).toFixed(1)}s`
    const name = `${step.dir.replace("packages/", "")} — ${step.label}`
    if (result.status === 0) {
        console.log(`✓ ${name}  ${elapsed}`)
        continue
    }
    failures.push(name)
    console.error(`✗ ${name}  ${elapsed}  (exit ${result.status})`)
    console.error(result.stdout)
    console.error(result.stderr)
}

if (failures.length > 0) {
    console.error(`\n${failures.length} of ${steps.length} browser-permission checks failed.`)
    process.exit(1)
}
console.log(`\nAll ${steps.length} browser-permission checks passed.`)
