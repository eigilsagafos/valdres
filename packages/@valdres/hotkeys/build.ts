import { readdir, unlink } from "node:fs/promises"
import { join } from "node:path"

export const buildOptions = {
    entrypoints: ["./src/index.ts", "./src/adapter-internals.ts"],
    outdir: "./dist",
    // The public entry and the adapter entry must share one dispatcher
    // registry, so both are split over one module graph instead of each
    // bundling its own copy.
    splitting: true,
    packages: "external" as const,
}

if (import.meta.main) {
    // A split build names chunks by content: drop old JavaScript so a stale
    // chunk cannot ship. Declarations under dist/types are the type build's.
    const entries = await readdir(buildOptions.outdir).catch(() => [])
    await Promise.all(
        entries
            .filter(name => name.endsWith(".js") || name.endsWith(".js.map"))
            .map(name => unlink(join(buildOptions.outdir, name))),
    )
    const result = await Bun.build(buildOptions)
    if (!result.success) {
        console.error(result.logs.join("\n"))
        process.exit(1)
    }
}
