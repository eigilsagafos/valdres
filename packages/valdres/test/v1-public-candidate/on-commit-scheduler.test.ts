import { expect, test } from "bun:test"
import { resolve } from "node:path"

const probe = resolve(
    import.meta.dir,
    "../../../../scripts/fixtures/on-commit-scheduler.mjs",
)
for (const scenario of [
    "control",
    "dropped-microtask",
    "dropped-timer",
    "fake-timers",
    "duplicate-wakes",
    "task-producer",
    "promise-producer",
    "promise-errors",
]) {
    test(`isolated commit scheduler: ${scenario}`, async () => {
        const child = Bun.spawn([process.execPath, probe, scenario], {
            stdout: "pipe",
            stderr: "pipe",
            env: {
                ...process.env,
                ON_COMMIT_MODULE: resolve(
                    import.meta.dir,
                    "../../src/index.ts",
                ),
            },
        })
        const [code, stdout, stderr] = await Promise.all([
            child.exited,
            new Response(child.stdout).text(),
            new Response(child.stderr).text(),
        ])
        expect({
            code,
            stderr,
            passed: stdout.includes('"status":"passed"'),
        }).toEqual({ code: 0, stderr: "", passed: true })
    })
}
