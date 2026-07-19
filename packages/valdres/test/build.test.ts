import { describe, expect, test } from "bun:test"
import { mkdtemp, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { buildOptions, removeStaleBuildJavaScript } from "../build"

describe("build output", () => {
    // Regression guard for the dev-only freeze. valdres is built once under
    // NODE_ENV=production; Bun special-cases `process.env.NODE_ENV` and would
    // inline it, folding `process.env.NODE_ENV === "production"` to `true` in the
    // dist. That bakes "always prod" into the published package and disables the
    // freeze for EVERY consumer — even in their dev — silently removing the
    // mutation safety net. The identity `define` in build.ts prevents the inlining
    // so the consumer resolves NODE_ENV themselves. Source tests can't catch this
    // (they run from src, not the bundle), hence a build-output assertion.
    test("does not inline process.env.NODE_ENV — consumer resolves it", async () => {
        const { outdir, ...inMemory } = buildOptions
        const result = await Bun.build(inMemory)
        expect(result.success).toBe(true)
        const code = (
            await Promise.all(result.outputs.map(output => output.text()))
        ).join("\n")
        // The runtime reference must survive; if it were folded we'd see
        // `typeof process !== "undefined" && true` (or `&& false`) instead.
        expect(code).toContain("process.env.NODE_ENV")
        expect(code).not.toMatch(/typeof process !== "undefined" && (true|false)/)
    })

    test("public and adapter entrypoints share one transaction runtime", async () => {
        const { outdir, ...inMemory } = buildOptions
        const result = await Bun.build(inMemory)
        expect(result.success).toBe(true)
        const outputs = await Promise.all(
            result.outputs.map(output => output.text()),
        )
        const index = result.outputs.findIndex(output =>
            output.path.endsWith("/index.js"),
        )
        const adapterInternals = result.outputs.findIndex(output =>
            output.path.endsWith("/adapter-internals.js"),
        )

        expect(index).toBeGreaterThanOrEqual(0)
        expect(adapterInternals).toBeGreaterThanOrEqual(0)
        expect(
            outputs.filter(code => code.includes("class TransactionContext")),
        ).toHaveLength(1)
        expect(outputs[index]).not.toContain("Transaction")
        expect(outputs[adapterInternals]).toContain("Transaction")
    })

    test("removes stale split chunks without deleting type output", async () => {
        const outdir = await mkdtemp(join(tmpdir(), "valdres-build-"))
        try {
            await Promise.all([
                Bun.write(join(outdir, "index.js"), "old index"),
                Bun.write(join(outdir, "chunk-old.js"), "old chunk"),
                Bun.write(join(outdir, "chunk-old.js.map"), "old map"),
                Bun.write(join(outdir, "index.d.ts"), "export {}"),
            ])

            await removeStaleBuildJavaScript(outdir)

            expect(await readdir(outdir)).toEqual(["index.d.ts"])
        } finally {
            await rm(outdir, { recursive: true, force: true })
        }
    })
})
