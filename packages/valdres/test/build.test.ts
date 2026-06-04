import { describe, expect, test } from "bun:test"
import { buildOptions } from "../build"

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
        const code = await result.outputs[0]!.text()
        // The runtime reference must survive; if it were folded we'd see
        // `typeof process !== "undefined" && true` (or `&& false`) instead.
        expect(code).toContain("process.env.NODE_ENV")
        expect(code).not.toMatch(/typeof process !== "undefined" && (true|false)/)
    })
})
