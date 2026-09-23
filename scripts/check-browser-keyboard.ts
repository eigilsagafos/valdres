/**
 * Runs `@valdres/browser-keyboard`'s suite and BOTH typechecks.
 *
 * Same three commands as `check-browser-media.ts`, for the same reason: the
 * publish-facing `tsconfig.json` narrows to `src/index.ts`, and `bun test`
 * erases types, so the `@ts-expect-error` assertions that keep keyboard state
 * unwritable only hold if `tsconfig.tests.json` is type-checked too.
 *
 *   bun run scripts/check-browser-keyboard.ts
 */
import { spawnSync } from "node:child_process"
import { join } from "node:path"
import { BROWSER_KEYBOARD_DIR } from "./lib/browser-keyboard-package"

const ROOT = join(import.meta.dir, "..")
const TSGO = join(ROOT, "node_modules", ".bin", "tsgo")
const cwd = join(ROOT, BROWSER_KEYBOARD_DIR)

const steps = [
    {
        label: "source typecheck",
        command: [TSGO, "--noEmit", "-p", "tsconfig.json"],
    },
    {
        label: "test typecheck (@ts-expect-error contracts)",
        command: [TSGO, "--noEmit", "-p", "tsconfig.tests.json"],
    },
    { label: "bun test", command: ["bun", "test"] },
] as const

const failures: string[] = []
for (const step of steps) {
    const started = performance.now()
    const result = spawnSync(step.command[0], step.command.slice(1), {
        cwd,
        encoding: "utf8",
    })
    const elapsed = `${((performance.now() - started) / 1000).toFixed(1)}s`
    if (result.status === 0) {
        console.log(`✓ browser-keyboard — ${step.label}  ${elapsed}`)
        continue
    }
    failures.push(step.label)
    console.error(
        `✗ browser-keyboard — ${step.label}  ${elapsed}  (exit ${result.status})`,
    )
    console.error(result.stdout)
    console.error(result.stderr)
}

if (failures.length > 0) {
    console.error(
        `\n${failures.length} of ${steps.length} browser-keyboard checks failed.`,
    )
    process.exit(1)
}
console.log(`\nAll ${steps.length} browser-keyboard checks passed.`)
