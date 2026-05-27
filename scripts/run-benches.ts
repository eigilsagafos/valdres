/**
 * Runs each *.bench.ts file in packages/valdres/test/performance in its own
 * `bun test` subprocess, sequentially. Process isolation prevents one bench
 * file's heap state — JSC hidden classes, inline caches, GC pressure — from
 * skewing measurements in the files that run after it. On memory-constrained
 * CI runners this otherwise produces phantom ratio shifts of 30–40% in the
 * downstream benches (see PR #129).
 *
 * Each subprocess appends its results to bench-results.ndjson, so the file
 * accumulates results across the whole suite just like the previous single-
 * process run did.
 */
import { readdirSync, existsSync, unlinkSync } from "fs"
import { join, resolve } from "path"

const PKG_DIR = resolve(import.meta.dir, "..", "packages", "valdres")
const BENCH_DIR = join(PKG_DIR, "test", "performance")
const RESULTS_FILE = join(BENCH_DIR, "bench-results.ndjson")
const TIMEOUT_MS = 60_000

if (existsSync(RESULTS_FILE)) unlinkSync(RESULTS_FILE)

const files = readdirSync(BENCH_DIR)
    .filter(f => f.endsWith(".bench.ts"))
    .sort()

if (files.length === 0) {
    console.error("No .bench.ts files found in", BENCH_DIR)
    process.exit(1)
}

console.log(`Running ${files.length} bench file(s) in isolated processes:`)
for (const f of files) console.log(`  - ${f}`)
console.log()

let failures = 0
for (const file of files) {
    const start = Date.now()
    const proc = Bun.spawnSync({
        cmd: [
            "bun",
            "test",
            "--timeout",
            String(TIMEOUT_MS),
            `./test/performance/${file}`,
        ],
        cwd: PKG_DIR,
        stdout: "inherit",
        stderr: "inherit",
    })
    const elapsed = ((Date.now() - start) / 1000).toFixed(1)
    if (proc.exitCode !== 0) {
        console.error(`\n✗ ${file} failed (exit ${proc.exitCode}) after ${elapsed}s\n`)
        failures++
    } else {
        console.log(`\n✓ ${file} (${elapsed}s)\n`)
    }
}

if (failures > 0) {
    console.error(`${failures} bench file(s) failed`)
    process.exit(1)
}
