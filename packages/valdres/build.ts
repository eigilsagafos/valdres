import { readdir, rmdir, unlink } from "node:fs/promises"
import { join } from "node:path"

export const buildOptions = {
    entrypoints: [
        "./src/index.ts",
        "./src/equality.ts",
        "./src/adapter-internals/v1.ts",
    ],
    outdir: "./dist",
    // Root and adapter-internals must share the exact module-local v1 domain.
    // Without splitting, each entry would receive a different owner token.
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

/** Parallel graph selected by the existing `development` export condition. */
export const developmentBuildOptions = {
    ...buildOptions,
    outdir: "./dist/development",
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
