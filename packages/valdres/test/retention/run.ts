import { mkdir, readFile, readdir, writeFile, rm } from "node:fs/promises"
import { join, resolve } from "node:path"
import { tmpdir } from "node:os"

const directory = import.meta.dir
const cwd = resolve(directory, "../..")
const fixtures = (await readdir(directory)).filter(name => name.endsWith(".test.ts")).sort()
if (fixtures.length !== 7) throw new Error("Review the mandatory retention case inventory before changing it")
const output = process.env.VALDRES_RETENTION_CAPTURE_DIR
    ? join(process.env.VALDRES_RETENTION_CAPTURE_DIR, `processes-${process.pid}-${Date.now()}`)
    : join(tmpdir(), `valdres-retention-${process.pid}-${Date.now()}`)
await mkdir(output, { recursive: true })
// Every assertion keeps its original Bun timeout; no process/test retry.
const cases = [
    ...fixtures.map(file => ({ name: file.replace(".test.ts", ""), files: [file], preload: false })),
    { name: "accumulated", files: fixtures, preload: true },
]
for (const entry of cases) {
    const capture = join(output, entry.name)
    await mkdir(capture, { recursive: true })
    const report = join(cwd, `junit-retention-${entry.name}.xml`)
    await rm(report, { force: true }) // stale output cannot satisfy this run
    const command = [process.execPath, "test",
        ...(entry.preload ? ["--preload", join(directory, "accumulated.ts")] : []),
        ...entry.files.map(file => join(directory, file)),
        "--reporter=junit", `--reporter-outfile=${report}`]
    await writeFile(join(capture, "command.json"), JSON.stringify({ command, cwd, bun: Bun.version, revision: Bun.revision, arch: process.arch }, null, 2))
    const started = performance.now()
    const child = Bun.spawn(command, {
        cwd, env: { ...process.env, VALDRES_RETENTION_CAPTURE_DIR: capture },
        stdout: "pipe", stderr: "pipe",
    })
    const [code, stdout, stderr] = await Promise.all([
        child.exited, new Response(child.stdout).text(), new Response(child.stderr).text(),
    ])
    await writeFile(join(capture, "stdout.log"), stdout)
    await writeFile(join(capture, "stderr.log"), stderr)
    console.log(stdout); console.error(stderr)
    await writeFile(join(capture, "result.json"), JSON.stringify({ code, milliseconds: performance.now() - started }, null, 2))
    if (code !== 0) throw new Error(`Mandatory retention case ${entry.name} failed (exit ${code}); evidence: ${capture}`)
    const xml = await readFile(report, "utf8")
    const summary = xml.match(/<testsuites\b[^>]*>/)?.[0] ?? ""
    for (const [attribute, expected] of Object.entries({ tests: entry.files.length, failures: 0, skipped: 0 })) {
        if (!summary.includes(`${attribute}="${expected}"`)) throw new Error(`Incomplete retention execution: ${entry.name}: ${summary}`)
    }
    await writeFile(join(capture, "junit.xml"), xml)
}
console.log(`Mandatory retention: ${fixtures.length} isolated + ${fixtures.length} accumulated-state cases passed; ${output}`)
