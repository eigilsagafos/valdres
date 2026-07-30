import { describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises"
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
        expect(code).not.toMatch(
            /typeof process !== "undefined" && (true|false)/,
        )
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
            output.path.endsWith("adapter-internals/v1.js"),
        )

        expect(index).toBeGreaterThanOrEqual(0)
        expect(adapterInternals).toBeGreaterThanOrEqual(0)
        expect(
            outputs.filter(code => code.includes("class TransactionContext")),
        ).toHaveLength(1)
        expect(
            outputs.filter(code =>
                code.includes('Symbol("valdres.storeDataAccess")'),
            ),
        ).toHaveLength(1)
        // Cross-module protocol symbol: store lifecycle cancels open resources
        // through it while TransactionContext implements it. Two copies would
        // silently make the method lookup `undefined` and turn every
        // disposal-with-open-transaction into a TypeError.
        expect(
            outputs.filter(code =>
                code.includes('Symbol("valdres.cancelOnStoreDispose")'),
            ),
        ).toHaveLength(1)
        // The single runtime must live in a shared chunk, not be duplicated
        // into (or defined by) either entry. The public entry may still
        // reference it by name: since the graph runtime stopped importing the
        // store constructor, the adapter graph no longer reaches
        // storeFromStoreData, which is therefore bundled index-only and imports
        // TransactionContext from the chunk under its real name.
        expect(outputs[index]).not.toContain("class TransactionContext")
        expect(outputs[adapterInternals]).toContain("Transaction")
    })

    test("removes stale split chunks without deleting type output", async () => {
        const outdir = await mkdtemp(join(tmpdir(), "valdres-build-"))
        try {
            await mkdir(join(outdir, "adapter-internals"))
            await Promise.all([
                Bun.write(join(outdir, "index.js"), "old index"),
                Bun.write(join(outdir, "chunk-old.js"), "old chunk"),
                Bun.write(join(outdir, "chunk-old.js.map"), "old map"),
                Bun.write(
                    join(outdir, "adapter-internals", "v1.js"),
                    "old adapter",
                ),
                Bun.write(join(outdir, "index.d.ts"), "export {}"),
            ])

            await removeStaleBuildJavaScript(outdir)

            expect(await readdir(outdir)).toEqual(["index.d.ts"])
        } finally {
            await rm(outdir, { recursive: true, force: true })
        }
    })
})
