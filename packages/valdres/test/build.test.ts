import { describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { buildOptions, removeStaleBuildJavaScript } from "../build"

// `outdir` is dropped so these bundle in memory; everything else — including
// `minify` — matches what `bun run build` publishes.
const { outdir: _outdir, ...inMemory } = buildOptions

const bundle = async (options: Parameters<typeof Bun.build>[0]) => {
    const result = await Bun.build(options)
    expect(result.success).toBe(true)
    const outputs = await Promise.all(
        result.outputs.map(output => output.text()),
    )
    return { result, outputs, code: outputs.join("\n") }
}

/** The published artifact. Contracts a consumer depends on are asserted against
 *  THIS, never against a friendlier build. */
let shippedCache: ReturnType<typeof bundle> | undefined
const shipped = () => (shippedCache ??= bundle(inMemory))

/** The same module graph with identifiers preserved. Minification renames
 *  classes and locals but cannot move code between chunks, so structural
 *  "exactly one copy of X" assertions remain valid — and readable — here. */
let readableCache: ReturnType<typeof bundle> | undefined
const readable = () =>
    (readableCache ??= bundle({ ...inMemory, minify: false }))

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
        const { code } = await shipped()
        // The whole comparison must survive, not just the member expression:
        // folding would leave a bare `true`/`false` with no "production" test,
        // and a consumer's bundler would have nothing left to match on.
        // Asserted on the minified output because that is what we publish —
        // minification rewrites `typeof process !== "undefined"` to
        // `typeof process < "u"`, so match only the part we actually rely on.
        expect(code).toContain("process.env.NODE_ENV")
        expect(code).toMatch(/process\.env\.NODE_ENV\s*===\s*"production"/)
    })

    // Companion guard for the engine self-checks — `assertPlanLegal` and the
    // `commitPlanAllocations` counter. Both observe invariants and costs only
    // valdres's own code can affect, so they are compiled OUT of the published
    // bundle rather than shipped behind a runtime flag: build.ts defines
    // `process.env.VALDRES_ENGINE_SELF_CHECKS` as "off" and the branches fold
    // to constants a consumer's bundler drops. If that define were ever lost,
    // the dist would ship both graphs AND unguarded `process.env` reads that
    // throw on module load in raw browser ESM — so assert every half here,
    // where a source test cannot see them.
    test("compiles out the engine self-checks", async () => {
        const { code } = await shipped()
        expect(code).not.toContain("VALDRES_ENGINE_SELF_CHECKS")
        expect(code).not.toContain("illegal CommitPlan")
        expect(code).not.toContain("commitPlanAllocations")
        expect(code).not.toContain("assertPlanLegal")
        expect(code).not.toContain("assertTreeTriggersSealed")
    })

    // The assertions above prove the self-check *graph* is absent, but not WHY.
    // If the define were lost, `process.env.VALDRES_ENGINE_SELF_CHECKS` would
    // survive as an unguarded `process.env` read that throws on module load in
    // raw browser ESM. Checking the folded branch on the unminified graph pins
    // the mechanism — minification erases the branch entirely, which would let
    // a regression here pass unnoticed above.
    test("folds the self-check guard rather than merely shaking it out", async () => {
        const { code } = await readable()
        expect(code).toContain("if (!IS_PROD && false)")
        expect(code).not.toContain("VALDRES_ENGINE_SELF_CHECKS")
    })

    // Symbol descriptions are string literals, so minification preserves them
    // verbatim — which makes them the one single-instance check we can run
    // directly against the published artifact.
    test("public and adapter entrypoints share one transaction runtime", async () => {
        const { outputs } = await shipped()
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
    })

    // Chunk placement of the runtime class itself. Minification renames
    // `TransactionContext`, so this half runs on the unminified graph —
    // splitting decides which chunk a declaration lands in before any renaming
    // happens, so the placement being asserted is identical in both builds.
    test("bundles the transaction runtime into the shared chunk, not an entry", async () => {
        const { result, outputs } = await readable()
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
