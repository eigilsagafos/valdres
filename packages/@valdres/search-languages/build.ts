/**
 * Multi-entry build. Every subpath in `package.json#exports` (the barrel
 * plus one entry per language) must emit its own dist file so the
 * prepack step — which rewrites each `./src/<x>.ts` export to
 * `./dist/<x>.js` — points at a real, importable module. A single-entry
 * `bun build src/index.ts` would leave 25 of 26 subpaths 404 after pack.
 *
 * No code-splitting: each language bundle inlines its own stemmer +
 * stopwords + the shared base-stemmer/createPreset. That duplicates the
 * ~12KB base-stemmer across bundles on disk, but a consumer only ever
 * imports the one language they use, and it guarantees a clean,
 * predictable `dist/<lang>.js` per entry (splitting emits hashed chunks
 * that the prepack export map can't address). `valdres` stays external
 * (peer dependency).
 */
const pkg = await Bun.file("./package.json").json()
const entrypoints = Object.values(pkg.exports) as string[]

const result = await Bun.build({
    entrypoints,
    outdir: "./dist",
    root: "./src",
    target: "browser",
    packages: "external",
    naming: "[dir]/[name].[ext]",
})

if (!result.success) {
    for (const log of result.logs) console.error(log)
    process.exit(1)
}
console.log(`Built ${entrypoints.length} entrypoints → dist/`)
