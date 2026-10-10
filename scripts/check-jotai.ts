/**
 * Runs `@valdres-react/jotai`: both typechecks, the adapter suite, and the
 * adapted upstream Jotai/jotai-family suite against this package and against
 * the pinned reference `jotai@3.0.1` (one process per upstream file; the
 * package's runner fails on any regression or stale known-gap entry). The
 * package is release-ignored; this job keeps the bounded candidate honest.
 *
 *   bun run scripts/check-jotai.ts
 *   bun run test:jotai
 */
import { spawnSync } from "node:child_process"
import { join } from "node:path"

const ROOT = join(import.meta.dir, "..")
const TSGO = join(ROOT, "node_modules", ".bin", "tsgo")
const DIR = "packages/@valdres-react/jotai"

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
    { label: "adapter suite", command: ["bun", "test"] },
    {
        label: "upstream suite (adapter)",
        command: ["bun", "run", "test:upstream"],
    },
    {
        label: "upstream suite (jotai@3.0.1)",
        command: ["bun", "run", "test:reference"],
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
    const name = `@valdres-react/jotai — ${step.label}`
    if (result.status === 0) {
        const matrix = result.stdout.match(/^matrix: .*$/m)?.[0]
        console.log(`✓ ${name}  ${elapsed}${matrix ? `\n    ${matrix}` : ""}`)
        continue
    }
    failures.push(name)
    console.error(`✗ ${name}  ${elapsed}  (exit ${result.status})`)
    console.error(result.stdout)
    console.error(result.stderr)
}

if (failures.length > 0) {
    console.error(
        `\n${failures.length} of ${steps.length} jotai checks failed.`,
    )
    process.exit(1)
}
console.log(`\nAll ${steps.length} jotai checks passed.`)
