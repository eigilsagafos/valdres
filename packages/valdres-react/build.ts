import { readdir, rmdir, unlink } from "node:fs/promises"
import { join } from "node:path"

export const buildOptions = {
    entrypoints: ["./src/index.ts", "./src/inspect.tsx"],
    outdir: "./dist",
    // The root bindings and the opt-in inspection bindings both use the
    // package-private StoreContext. One split graph keeps that Context object
    // identical without making the root entry import inspection code.
    splitting: true,
    packages: "external" as const,
}

/** Remove prior JavaScript output before a split build so an old chunk cannot
 * be published after its importing entry changes. Declaration output is owned
 * by the independent type build and is deliberately preserved. */
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
    const result = await Bun.build(buildOptions)
    if (!result.success) {
        console.error(result.logs.join("\n"))
        process.exit(1)
    }
}
