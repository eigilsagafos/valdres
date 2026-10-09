/**
 * Runs the adapted Jotai 3.0.1 suite one file per process (Bun's fake timers
 * leak between files in one process), against the adapter by default or real
 * Jotai with `JOTAI_IMPL=jotai`. Against the adapter it also fails on a stale
 * gap manifest: every listed test must have been registered.
 *
 *   bun run test/upstream/run.ts
 *   JOTAI_IMPL=jotai bun run test/upstream/run.ts
 */
import { Glob } from "bun"
import { existsSync, mkdtempSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { gaps } from "./gaps"

const impl = process.env.JOTAI_IMPL === "jotai" ? "jotai" : "valdres"
const root = `${import.meta.dir}/..`
const files = [
    ...new Glob("upstream/**/*.test.{ts,tsx}").scanSync({ cwd: root }),
].sort()

const reports = mkdtempSync(join(tmpdir(), "valdres-jotai-gaps-"))
let failed = 0
let passed = 0
const problems: string[] = []
for (const [index, file] of files.entries()) {
    const report = join(reports, `${index}.txt`)
    const child = Bun.spawnSync(["bun", "test", `./test/${file}`], {
        cwd: `${root}/..`,
        env: {
            ...process.env,
            JOTAI_IMPL: impl,
            JOTAI_GAP_REPORT: report,
            FORCE_COLOR: "0",
        },
        stdout: "pipe",
        stderr: "pipe",
    })
    const output = child.stdout.toString() + child.stderr.toString()
    const pass = Number(/^\s*(\d+) pass$/m.exec(output)?.[1] ?? 0)
    const fail = Number(/^\s*(\d+) fail$/m.exec(output)?.[1] ?? 0)
    passed += pass
    failed += fail
    const short = file.replace(/^upstream\//, "")
    console.log(
        `${child.exitCode === 0 ? "ok  " : "FAIL"} ${short}: ${pass} pass, ${fail} fail`,
    )
    if (child.exitCode !== 0) problems.push(`${short}\n${output}`)
    const registered = new Set(
        existsSync(report) ? readFileSync(report, "utf8").split("\n") : [],
    )
    for (const [title, gap] of Object.entries(gaps)) {
        if (gap.file === short && !registered.has(title)) {
            problems.push(`${short}: gap "${title}" matches no test`)
        }
    }
}
console.log(
    `\n${impl}: ${passed} pass, ${failed} fail across ${files.length} files`,
)
if (impl === "valdres") {
    const listed = Object.values(gaps)
    const skipped = listed.filter(
        gap => gap.skip || gap.kind === "not-applicable",
    ).length
    const inverted = listed.length - skipped
    console.log(
        `matrix: ${passed + failed + skipped} upstream tests = ${passed - inverted} pass + ${inverted} known gaps verified failing + ${skipped} skipped`,
    )
    const byReason = new Map<string, number>()
    for (const gap of listed) {
        const key = `${gap.kind}${gap.skip ? " (skipped)" : ""}: ${gap.reason}`
        byReason.set(key, (byReason.get(key) ?? 0) + 1)
    }
    for (const [key, count] of byReason) console.log(`  ${count} ${key}`)
}
if (problems.length > 0) {
    console.error(`\n${problems.join("\n\n")}`)
    process.exit(1)
}
