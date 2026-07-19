import { readdir, unlink } from "node:fs/promises"
import { join } from "node:path"

const pkg = await Bun.file("package.json").json()
const version = pkg.version

export const buildOptions = {
    entrypoints: ["./src/index.ts", "./src/adapter-internals.ts"],
    outdir: "./dist",
    // The adapter-internals entrypoint must share the exact transaction module
    // instance used by the public store bundle. Without splitting, Bun would
    // duplicate commit registries and adapter commits would miss listeners.
    splitting: true,
    external: ["./package.json"],
    packages: "external" as const,
    define: {
        "process.env.VALDRES_VERSION": JSON.stringify(version),
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
        entries
            .filter(
                entry =>
                    entry.isFile() &&
                    (entry.name.endsWith(".js") ||
                        entry.name.endsWith(".js.map")),
            )
            .map(entry => unlink(join(outdir, entry.name))),
    )
}

if (import.meta.main) {
    await removeStaleBuildJavaScript(buildOptions.outdir)
    await Bun.build(buildOptions)
}
