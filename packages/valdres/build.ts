const pkg = await Bun.file("package.json").json()
const version = pkg.version

export const buildOptions = {
    entrypoints: ["./src/index.ts"],
    outdir: "./dist",
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

if (import.meta.main) {
    await Bun.build(buildOptions)
}
