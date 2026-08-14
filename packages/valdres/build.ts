import { readdir, rmdir, unlink } from "node:fs/promises"
import { join } from "node:path"

const pkg = await Bun.file("package.json").json()
const version = pkg.version

export const buildOptions = {
    entrypoints: ["./src/index.ts", "./src/adapter-internals/v1.ts"],
    outdir: "./dist",
    // The adapter-internals entrypoint must share the exact transaction module
    // instance used by the public store bundle. Without splitting, Bun would
    // duplicate commit registries and adapter commits would miss listeners.
    splitting: true,
    external: ["./package.json"],
    packages: "external" as const,
    // Ship a minified dist. Most consumers bundle valdres and would minify it
    // themselves, but pre-minifying still pays off twice: the published package
    // drops ~32% gzip (faster installs, smaller CDN/unpkg payloads for no-build
    // ESM consumers), and even a bundling consumer ends up ~0.4% smaller,
    // because mangling our internals here beats what their bundler infers
    // through the module graph on its own.
    //
    // Deliberately NO source maps. They would restore readable stack traces
    // through valdres internals, but measured at +167% on the packed tarball
    // (112 KB -> 299 KB gzip) — every consumer pays that download so the rare
    // one stepping through our internals doesn't see mangled names. Revisit by
    // publishing maps as a separate artifact if that tradeoff ever inverts.
    //
    // Two contracts survive minification and are asserted in test/build.test.ts
    // against this exact (minified) output: `process.env.NODE_ENV` must remain
    // a runtime reference, and the engine self-checks must be gone.
    minify: true,
    define: {
        "process.env.VALDRES_VERSION": JSON.stringify(version),
        // Raw CDN/edge runtimes do not expose process. The default artifact
        // treats that absence as production; a second build below overrides
        // this define for the explicit development export condition.
        __VALDRES_PROCESSLESS_DEVELOPMENT__: "false",
        __VALDRES_BUILD_VARIANT__: JSON.stringify("default"),
        // Compile out the engine self-checks (assertPlanLegal in
        // src/lib/commitPlans.ts, assertTreeTriggersSealed in
        // src/lib/treeTriggerGroups.ts). They assert invariants only valdres's
        // own code can violate, so they belong to this repo's test loop, not to
        // a consumer's bundle.
        "process.env.VALDRES_ENGINE_SELF_CHECKS": JSON.stringify("off"),
        // Map NODE_ENV to itself so Bun does NOT inline it at *our* build time.
        // valdres is built once under NODE_ENV=production; without this, Bun folds
        // `process.env.NODE_ENV === "production"` to `true` in the dist, baking
        // "always prod" into the published package — which disables the dev-only
        // freeze for *every* consumer, even when they run in development. Keeping it
        // a runtime reference lets the consumer's bundler/runtime resolve it for
        // their own environment. See src/lib/IS_PROD.ts. Guarded by a build test.
        "process.env.NODE_ENV": "process.env.NODE_ENV",
    },
}

/** A parallel graph for bundlers that enable the `development` package export
 * condition. It still honors NODE_ENV when process.env exists; only the
 * process-less fallback differs from the default artifact. Keeping both public
 * entrypoints in this split graph preserves their shared transaction runtime.
 *
 * This intentionally adds roughly 35% to the packed-package gzip size while a
 * selected consumer bundle grows by less than 0.1%. A thin static ESM wrapper
 * cannot change the already-instantiated IS_PROD module without mutating a
 * global or making behavior depend on which entry loaded first, so the
 * install-time duplication buys deterministic, isolated runtime semantics. */
export const developmentBuildOptions = {
    ...buildOptions,
    outdir: "./dist/development",
    define: {
        ...buildOptions.define,
        __VALDRES_PROCESSLESS_DEVELOPMENT__: "true",
        __VALDRES_BUILD_VARIANT__: JSON.stringify("development"),
    },
}

/** Split builds emit content-hashed chunks. Remove prior JavaScript output so
 * repeated local/release builds cannot publish unreachable stale chunks, while
 * preserving declaration files produced by the independent type build. */
export const removeStaleBuildJavaScript = async (outdir: string) => {
    let entries
    try {
        entries = await readdir(outdir, { withFileTypes: true })
    } catch (error) {
        if ((error as { code?: string }).code === "ENOENT") return
        throw error
    }

    await Promise.all(
        entries.map(async entry => {
            const path = join(outdir, entry.name)
            if (entry.isDirectory()) {
                await removeStaleBuildJavaScript(path)
                try {
                    await rmdir(path)
                } catch (error) {
                    if ((error as { code?: string }).code !== "ENOTEMPTY") {
                        throw error
                    }
                }
                return
            }
            if (
                entry.isFile() &&
                (entry.name.endsWith(".js") || entry.name.endsWith(".js.map"))
            ) {
                await unlink(path)
            }
        }),
    )
}

if (import.meta.main) {
    await removeStaleBuildJavaScript(buildOptions.outdir)
    for (const options of [buildOptions, developmentBuildOptions]) {
        const result = await Bun.build(options)
        if (!result.success) {
            console.error(result.logs.join("\n"))
            process.exit(1)
        }
    }
}
