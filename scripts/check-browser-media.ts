/**
 * Runs the package suites and BOTH typechecks for every migrated browser media
 * package, from the one explicit list in `lib/browser-media-packages.ts`.
 *
 * Why a script and not `bun --filter … test`: each package needs three commands,
 * and one of them cannot be expressed as a workspace filter at all. A package's
 * publish-facing `tsconfig.json` narrows to `src/index.ts` so declaration emit
 * stays clean, which means it never sees the test tree — and `bun test` erases
 * types entirely, so a `@ts-expect-error` asserting that an external source
 * rejects `store.set` would silently pass even if the source became writable.
 * `tsconfig.tests.json` is what actually holds that contract, so it has to run.
 *
 *   bun run scripts/check-browser-media.ts             # tests + both typechecks
 *   bun run scripts/check-browser-media.ts --tests
 *   bun run scripts/check-browser-media.ts --typecheck
 */
import { spawnSync } from "node:child_process"
import { join } from "node:path"
import { BROWSER_MEDIA_PACKAGES } from "./lib/browser-media-packages"

const ROOT = join(import.meta.dir, "..")
const TSGO = join(ROOT, "node_modules", ".bin", "tsgo")

const args = new Set(process.argv.slice(2))
const unknown = [...args].filter(
    arg => !["--tests", "--typecheck"].includes(arg),
)
if (unknown.length > 0) {
    console.error(`Unknown argument(s): ${unknown.join(", ")}`)
    process.exit(2)
}
const runTests = args.size === 0 || args.has("--tests")
const runTypecheck = args.size === 0 || args.has("--typecheck")

interface Step {
    readonly label: string
    readonly command: readonly string[]
    readonly cwd: string
}

const steps: Step[] = []
for (const media of BROWSER_MEDIA_PACKAGES) {
    const cwd = join(ROOT, "packages", "@valdres", media.dir)
    if (runTypecheck) {
        steps.push({
            label: `${media.dir} — source typecheck`,
            command: [TSGO, "--noEmit", "-p", "tsconfig.json"],
            cwd,
        })
        steps.push({
            label: `${media.dir} — test typecheck (@ts-expect-error contracts)`,
            command: [TSGO, "--noEmit", "-p", "tsconfig.tests.json"],
            cwd,
        })
    }
    if (runTests) {
        steps.push({
            label: `${media.dir} — bun test`,
            command: ["bun", "test"],
            cwd,
        })
    }
}

const failures: string[] = []
for (const step of steps) {
    const started = performance.now()
    const result = spawnSync(step.command[0]!, step.command.slice(1), {
        cwd: step.cwd,
        encoding: "utf8",
    })
    const elapsed = `${((performance.now() - started) / 1000).toFixed(1)}s`
    if (result.status === 0) {
        console.log(`✓ ${step.label}  ${elapsed}`)
        continue
    }
    failures.push(step.label)
    console.error(`✗ ${step.label}  ${elapsed}  (exit ${result.status})`)
    console.error(result.stdout)
    console.error(result.stderr)
}

if (failures.length > 0) {
    console.error(
        `\n${failures.length} of ${steps.length} browser media checks failed:\n` +
            failures.map(label => `  - ${label}`).join("\n"),
    )
    process.exit(1)
}
console.log(
    `\nAll ${steps.length} checks passed across ${BROWSER_MEDIA_PACKAGES.length} migrated browser media packages.`,
)
