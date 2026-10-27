/**
 * Runs `@valdres-react/recoil`: both typechecks, the package suite (the
 * differential scenarios against the recorded recoil@0.7.7 reference, the
 * adapter and Valdres-interop tests), and a fresh check that recoil@0.7.7 on
 * React 18.3.1 still produces the recorded reference. The package is
 * release-ignored; this job keeps the bounded adapter honest.
 *
 *   bun run scripts/check-recoil.ts
 *   bun run test:recoil
 */
import { spawnSync } from "node:child_process"
import { join } from "node:path"

const ROOT = join(import.meta.dir, "..")
const TSGO = join(ROOT, "node_modules", ".bin", "tsgo")
const DIR = "packages/@valdres-react/recoil"

const steps = [
    {
        label: "source typecheck",
        command: [TSGO, "--noEmit", "-p", "tsconfig.json"],
    },
    {
        label: "test typecheck",
        // --singleThreaded: see scripts/check-hotkeys.ts (tsgo realpath race,
        // spurious TS2307 about 1% of multi-threaded runs).
        command: [
            TSGO,
            "--noEmit",
            "--singleThreaded",
            "-p",
            "tsconfig.tests.json",
        ],
    },
    { label: "package suite", command: ["bun", "test"] },
    {
        label: "reference (recoil@0.7.7 on React 18.3.1)",
        command: ["bun", "run", "test:oracle"],
    },
]

const failures: string[] = []
for (const step of steps) {
    const started = performance.now()
    const result = spawnSync(step.command[0]!, step.command.slice(1), {
        cwd: join(ROOT, DIR),
        encoding: "utf8",
    })
    const elapsed = `${((performance.now() - started) / 1000).toFixed(1)}s`
    const name = `@valdres-react/recoil — ${step.label}`
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
    console.error(
        `\n${failures.length} of ${steps.length} recoil checks failed.`,
    )
    process.exit(1)
}
console.log(`\nAll ${steps.length} recoil checks passed.`)
