import { readdir, rmdir, unlink } from "node:fs/promises"
import { join } from "node:path"

const pkg = await Bun.file("package.json").json()
const version = pkg.version

const commonDefine = {
    "process.env.VALDRES_VERSION": JSON.stringify(version),
    // Compile out the engine self-checks: assertPlanLegal (defined in
    // src/lib/commitPlans.ts, called in src/lib/commitEngine.ts) and
    // assertTreeTriggersSealed (defined in src/lib/treeTriggerGroups.ts,
    // called in src/lib/propagateUpdatedAtoms.ts). Each is guarded at its
    // call site by this same env read. They assert invariants only valdres's
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
}

const commonBuild = {
    entrypoints: ["./src/index.ts", "./src/adapter-internals/v1.ts"],
    // The adapter-internals entrypoint must share the exact transaction module
    // instance used by the public store bundle. Without splitting, Bun would
    // duplicate commit registries and adapter commits would miss listeners.
    // Each published graph is its own split build, so a bundler that picks one
    // export condition gets one shared runtime.
    splitting: true,
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
    minify: true,
}

/**
 * Rewrite a source file so every `IS_PROD` use site is the boolean literal
 * `true` or `false`. An imported `const IS_PROD = true` is NOT enough: Bun
 * does not fold that binding into other modules, so `if (!IS_PROD)` survives
 * minify and the freeze / instrumentation graphs stay in the bundle.
 *
 * Import specifiers that become empty after dropping `IS_PROD` are removed
 * so the rewritten file does not import a module it no longer references.
 */
export const inlineIsProdSource = (source: string, isProd: boolean): string => {
    const literal = isProd ? "true" : "false"

    const withoutImport = source.replace(
        /import\s*\{([^}]*)\}\s*from\s*(["'][^"']+["']);?/g,
        (full, names: string, from: string) => {
            const parts = names
                .split(",")
                .map(part => part.trim())
                .filter(Boolean)
            const kept = parts.filter(part => {
                const imported = part.split(/\s+as\s+/)[0].trim()
                return imported !== "IS_PROD"
            })
            if (kept.length === parts.length) return full
            if (kept.length === 0) return ""
            return `import { ${kept.join(", ")} } from ${from}`
        },
    )

    return withoutImport.replace(/\bIS_PROD\b/g, literal)
}

export const createInlineIsProdPlugin = (
    isProd: boolean,
): import("bun").BunPlugin => ({
    name: "inline-is-prod",
    setup(build) {
        build.onLoad({ filter: /\.ts$/ }, async (args: { path: string }) => {
            const path = args.path.replaceAll("\\", "/")
            if (!path.includes("/src/") || path.includes(".test.")) return
            if (path.endsWith("/lib/IS_PROD.ts")) {
                return {
                    contents: `export const IS_PROD = ${isProd}\n`,
                    loader: "ts",
                }
            }
            const text = await Bun.file(args.path).text()
            if (!text.includes("IS_PROD")) return
            return {
                contents: inlineIsProdSource(text, isProd),
                loader: "ts",
            }
        })
    },
})

export const buildOptions = {
    ...commonBuild,
    outdir: "./dist",
    define: {
        ...commonDefine,
        // Raw CDN/edge runtimes do not expose process. The default artifact
        // treats that absence as production; the development graph overrides
        // this define. Vite/webpack production builds match `production` and
        // get the folded graph below instead.
        __VALDRES_PROCESSLESS_DEVELOPMENT__: "false",
        __VALDRES_BUILD_VARIANT__: JSON.stringify("default"),
    },
}

/** A parallel graph for bundlers that enable the `development` package export
 * condition. It still honors NODE_ENV when process.env exists; only the
 * process-less fallback differs from the default artifact. Keeping both public
 * entrypoints in this split graph preserves their shared transaction runtime.
 *
 * This intentionally adds roughly 35% to the packed-package gzip size while a
 * selected consumer bundle grows by less than 0.2%. A thin static ESM wrapper
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

/** Folded graph for the `production` export condition. Every `IS_PROD` use
 * site is the literal `true`, so minify deletes the freeze and the
 * architecture counters. Vite and webpack production builds match this
 * condition. The default `import` graph is left unfolded so Node/Bun/esbuild
 * still honor `NODE_ENV=development`. */
export const productionBuildOptions = {
    ...commonBuild,
    outdir: "./dist/production",
    plugins: [createInlineIsProdPlugin(true)],
    define: {
        ...commonDefine,
        __VALDRES_PROCESSLESS_DEVELOPMENT__: "false",
        __VALDRES_BUILD_VARIANT__: JSON.stringify("production"),
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
    for (const options of [
        buildOptions,
        developmentBuildOptions,
        productionBuildOptions,
    ]) {
        const result = await Bun.build(options)
        if (!result.success) {
            console.error(result.logs.join("\n"))
            process.exit(1)
        }
    }
}
