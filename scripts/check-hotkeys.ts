/**
 * Runs `@valdres/hotkeys` and `@valdres-react/hotkeys`: each package's suite
 * and BOTH typechecks. The publish-facing `tsconfig.json` narrows to the
 * entries and `bun test` erases types, so `tsconfig.tests.json` is what checks
 * the tests and fixtures.
 *
 *   bun run scripts/check-hotkeys.ts
 *   bun run test:hotkeys
 */
import { spawnSync } from "node:child_process"
import { join } from "node:path"

const ROOT = join(import.meta.dir, "..")
const TSGO = join(ROOT, "node_modules", ".bin", "tsgo")
const PACKAGES = [
    "packages/@valdres/hotkeys",
    "packages/@valdres-react/hotkeys",
] as const

const steps = PACKAGES.flatMap(dir => [
    {
        dir,
        label: "source typecheck",
        command: [TSGO, "--noEmit", "-p", "tsconfig.json"],
    },
    {
        dir,
        label: "test typecheck",
        // --singleThreaded works around a race in tsgo 7.0.0-dev.20260521.1:
        // multi-threaded, it occasionally corrupts the realpath of a module it
        // resolved and reports a spurious TS2307/TS2875 (about 1% of these runs
        // on macOS; never observed single-threaded). It changes scheduling
        // only, not the files or options checked, and is not a guarantee
        // against other checker failures. Reconsider after a tsgo upgrade stops
        // reproducing it multi-threaded. The packages' own `typecheck:tests`
        // scripts are still multi-threaded.
        command: [
            TSGO,
            "--noEmit",
            "--singleThreaded",
            "-p",
            "tsconfig.tests.json",
        ],
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
    console.error(
        `\n${failures.length} of ${steps.length} hotkeys checks failed.`,
    )
    process.exit(1)
}
console.log(`\nAll ${steps.length} hotkeys checks passed.`)
