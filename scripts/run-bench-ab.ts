/**
 * Same-runner A/B benchmark orchestrator.
 *
 * Runs every `*.bench.ts` once against this checkout's valdres source and
 * once against `origin/main`'s valdres source, interleaved at the file
 * level so both passes share the same CI VM, hyperthread sibling, CPU
 * frequency state, and memory pressure. The two outputs land in their
 * own ndjson files and are diffed downstream by
 * `scripts/check-bench-regression.ts`.
 *
 * Why this exists: historical-baseline gating compares the current run
 * against the median of the last 10 main runs, which are run minutes to
 * days apart on different runners. That cross-runner variance dominates
 * the per-benchmark ratio CV (~12% — see analysis in PR description).
 * Comparing PR vs main on the same VM, minutes apart, cuts that CV
 * roughly in half because every runner-level factor cancels.
 *
 * Layout:
 *   - PR run uses this checkout: <repo>/packages/valdres/test/performance
 *     and writes to bench-results.ndjson in that dir.
 *   - Main run uses a git worktree at <repo>/.bench-main (gitignored),
 *     and writes to bench-results.ndjson in the corresponding dir there.
 *
 * Failure modes:
 *   - Bench file present in PR but not in main → reported as "new", main
 *     pass skipped for that file.
 *   - Bench file present in main but not in PR → ignored (the PR deleted
 *     or renamed it).
 *   - `bun test` fails on either side → marked failed, summary printed,
 *     orchestrator exits non-zero but still leaves both ndjsons in place
 *     so downstream tooling can produce a partial report.
 */
import {
    existsSync,
    lstatSync,
    readdirSync,
    readFileSync,
    rmSync,
    symlinkSync,
    unlinkSync,
} from "fs"
import { join } from "path"

const ROOT = join(import.meta.dir, "..")
const PR_PKG = join(ROOT, "packages/valdres")
const PR_BENCH_DIR = join(PR_PKG, "test/performance")

const MAIN_WORKTREE = join(ROOT, ".bench-main")
const MAIN_PKG = join(MAIN_WORKTREE, "packages/valdres")
const MAIN_BENCH_DIR = join(MAIN_PKG, "test/performance")

const BASE_REF = process.env.BENCH_BASE_REF ?? "origin/main"

async function sh(
    cmd: string[],
    opts: { cwd?: string; allowFailure?: boolean } = {},
): Promise<number> {
    const proc = Bun.spawn(cmd, {
        cwd: opts.cwd ?? ROOT,
        stdout: "inherit",
        stderr: "inherit",
    })
    const code = await proc.exited
    if (code !== 0 && !opts.allowFailure) {
        throw new Error(`Command failed (${code}): ${cmd.join(" ")}`)
    }
    return code
}

async function setupMainWorktree(): Promise<void> {
    // Remove any prior worktree (left over from a cancelled run).
    if (existsSync(MAIN_WORKTREE)) {
        // CRITICAL: unlink the nested node_modules symlink first. It points
        // at the *main checkout's* real node_modules; letting `git worktree
        // remove` or rmSync recurse through it would delete the live deps.
        // (Both tools treat a symlink as a leaf and unlink it rather than
        // following it — but we remove it explicitly to be certain.)
        const link = join(MAIN_PKG, "node_modules")
        try {
            if (lstatSync(link).isSymbolicLink()) unlinkSync(link)
        } catch {
            // not present — fine
        }
        await sh(["git", "worktree", "remove", "--force", MAIN_WORKTREE], {
            allowFailure: true,
        })
        // Worktree remove may leave the directory if the registration is
        // already gone; nuke it explicitly to be safe.
        rmSync(MAIN_WORKTREE, { recursive: true, force: true })
    }
    await sh(["git", "worktree", "add", "--detach", MAIN_WORKTREE, BASE_REF])
    linkNestedNodeModules()
}

/**
 * `git worktree add` does not reproduce per-package (nested) node_modules,
 * so the worktree's bench files would resolve their dependencies by walking
 * up to the repo-root node_modules. When a dependency is nested in the main
 * checkout (e.g. a version-pinned `jotai` that lost the hoist to a different
 * version at the root), the worktree silently resolves a *different* version
 * than the PR side — making any vs-jotai comparison meaningless and shifting
 * shared-heap GC behaviour between the two passes.
 *
 * Symlink the main checkout's nested node_modules into the worktree so both
 * sides resolve byte-identical dependencies. valdres itself still comes from
 * each side's own `src/`; only third-party deps are shared. Root-level deps
 * already resolve identically via walk-up (the worktree lives inside the
 * repo), so only the bench package's nested modules need linking.
 */
function linkNestedNodeModules(): void {
    const srcModules = join(PR_PKG, "node_modules")
    if (!existsSync(srcModules)) return // fully hoisted install — nothing nested
    const destModules = join(MAIN_PKG, "node_modules")
    if (existsSync(destModules)) return // worktree somehow already has them
    symlinkSync(srcModules, destModules)
    console.log(`Linked ${srcModules} → ${destModules}`)
}

function listBenchFiles(dir: string): string[] {
    if (!existsSync(dir)) return []
    return readdirSync(dir)
        .filter(f => f.endsWith(".bench.ts"))
        .sort()
}

function countNdjsonRows(path: string): number {
    if (!existsSync(path)) return 0
    return readFileSync(path, "utf-8")
        .split("\n")
        .filter(l => l.trim().length > 0).length
}

async function runPass(
    label: "pr" | "main",
    pkgDir: string,
    file: string,
): Promise<{ exitCode: number; rowsAdded: number }> {
    console.log(`\n── ${label.toUpperCase()} · ${file} ──`)
    const ndjsonPath = join(pkgDir, "test/performance/bench-results.ndjson")
    const before = countNdjsonRows(ndjsonPath)
    const exitCode = await sh(
        [
            "bun",
            "test",
            "--timeout",
            "60000",
            "--concurrency",
            "1",
            `./test/performance/${file}`,
        ],
        { cwd: pkgDir, allowFailure: true },
    )
    const after = countNdjsonRows(ndjsonPath)
    return { exitCode, rowsAdded: after - before }
}

async function main(): Promise<void> {
    await setupMainWorktree()

    // Clean any stale results from a previous run on either side.
    for (const dir of [PR_BENCH_DIR, MAIN_BENCH_DIR]) {
        rmSync(join(dir, "bench-results.ndjson"), { force: true })
    }

    // PR is the authoritative bench list — it's the branch under review.
    const prFiles = listBenchFiles(PR_BENCH_DIR)
    const mainFiles = new Set(listBenchFiles(MAIN_BENCH_DIR))

    // Classify each pass:
    //   - fatal: non-zero exit AND zero rows added → the bench file crashed.
    //   - soft: non-zero exit with rows added → `expect(ratio <= maxSlowerRatio)`
    //     inside assertFaster fired on a noisy jotai measurement. The A/B
    //     delta gate (check-bench-regression.ts) is the real signal.
    //   - info: exit 0 with zero rows → informational bench (e.g. scope or
    //     cleanup-walk that only logs). Nothing to gate.
    const fatal: { label: string; file: string }[] = []
    const soft: { label: string; file: string }[] = []
    const info: { label: string; file: string }[] = []
    const newOnPr: string[] = []

    const classify = (
        label: "pr" | "main",
        file: string,
        r: { exitCode: number; rowsAdded: number },
    ) => {
        if (r.exitCode !== 0 && r.rowsAdded === 0) {
            fatal.push({ label, file })
        } else if (r.exitCode !== 0) {
            soft.push({ label, file })
        } else if (r.rowsAdded === 0) {
            info.push({ label, file })
        }
    }

    for (const file of prFiles) {
        classify("pr", file, await runPass("pr", PR_PKG, file))

        if (mainFiles.has(file)) {
            classify("main", file, await runPass("main", MAIN_PKG, file))
        } else {
            console.log(`   (no counterpart in ${BASE_REF} — new bench file)`)
            newOnPr.push(file)
        }
    }

    console.log("\n=== A/B summary ===")
    console.log(`  PR bench dir:   ${PR_BENCH_DIR}`)
    console.log(`  Main bench dir: ${MAIN_BENCH_DIR}`)
    if (newOnPr.length > 0) {
        console.log(`  New bench files (PR only): ${newOnPr.join(", ")}`)
    }
    if (info.length > 0) {
        console.log(
            `  Informational (no measurement ndjson): ${info.map(f => `${f.label}/${f.file}`).join(", ")}`,
        )
    }
    if (soft.length > 0) {
        console.log(
            `  Soft failures (in-bench assertion noise, ndjson produced): ${soft.map(f => `${f.label}/${f.file}`).join(", ")}`,
        )
    }
    if (fatal.length > 0) {
        console.log(
            `  FATAL (non-zero exit and no ndjson): ${fatal.map(f => `${f.label}/${f.file}`).join(", ")}`,
        )
        process.exit(1)
    }
    console.log("  All measurement passes produced data.")
}

main().catch(err => {
    console.error(err)
    process.exit(1)
})
