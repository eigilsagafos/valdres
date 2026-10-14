// Diagnostic adapter only. The fixture's async body is unchanged.
// This module never imports bun:test and never stores tested payloads/callbacks.
import assert from "node:assert/strict"
import { writeSync, writeFileSync } from "node:fs"
const hooks: (() => void)[] = []
export const afterAll = (hook: () => void) => { hooks.push(hook) }
export const expect = (value: unknown) => ({
    toBe: (expected: unknown) => assert.equal(value, expected),
    toHaveLength: (expected: number) => assert.equal((value as unknown[]).length, expected),
})
export function test(name: string, body: () => Promise<void>): void {
    setTimeout(() => {
        const start = performance.now()
        let failed = false
        let flushed = false
        const save = (outcome: string, error?: unknown) => {
            const record = { name, outcome, elapsedMs: performance.now() - start,
                error: error === undefined ? undefined : String(error), versions: process.versions,
                bunRevision: Bun.revision, argv: process.argv, platform: process.platform, arch: process.arch }
            writeSync(2, `[standalone-result] ${JSON.stringify(record)}\n`)
            if (process.env.RUNNER_RESULT) writeFileSync(process.env.RUNNER_RESULT, JSON.stringify(record, null, 2))
        }
        const flush = () => { if (!flushed) { flushed = true; for (const hook of hooks) hook() } }
        const deadline = setTimeout(() => {
            failed = true
            process.exitCode = 1
            save("timeout-5000")
            flush()
        }, 5000)
        // Resolution reactions capture bookkeeping only. body is the original
        // async test function, not a transaction body or onCommit effect.
        void body().then(() => {
            clearTimeout(deadline)
            if (performance.now() - start > 5000) failed = true
            if (failed) { process.exitCode = 1; save("finished-after-failure") }
            else save("pass")
            flush()
        }, error => {
            clearTimeout(deadline)
            failed = true
            process.exitCode = 1
            save("assertion-or-body-failure", error)
            flush()
        })
    }, 0)
}
