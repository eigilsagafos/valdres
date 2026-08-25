import { discover } from "./src/discover"
import { compileMdx } from "./src/compile-mdx"
import { renderPages } from "./src/render"
import { generateLlmsTxt, generateMarkdownPages } from "./src/generate-llms-txt"
import { generateSitemap } from "./src/generate-sitemap"
import {
    bundleClient,
    bundleDemos,
    bundleLanding,
    islandDefine,
    readValdresVersion,
} from "./src/islands-build"
import { $ } from "bun"

const rootDir = import.meta.dir.replace("/docs", "")
const distDir = `${import.meta.dir}/dist`
const siteUrl = "https://valdres.dev"

const valdresVersion = await readValdresVersion(rootDir)

// See islands-build.ts for why the islands need valdres's own build defines.
// scripts/check-docs-islands.ts evaluates these exact bundles in CI.
const define = islandDefine(valdresVersion, "production")

// Start from a clean slate — stale routes from earlier builds would otherwise
// ship and get indexed by pagefind.
import { rm } from "node:fs/promises"
await rm(distDir, { recursive: true, force: true })

console.log("🔍 Discovering MDX files...")
const entries = await discover(rootDir)
console.log(`   Found ${entries.length} pages`)

console.log("📝 Compiling MDX...")
const compiled = await compileMdx(entries)

console.log("🎨 Building CSS...")
// Invoke the bin directly: the package is @tailwindcss/cli but its bin is
// named `tailwindcss`, and `bunx @tailwindcss/cli` mis-resolves that mapping
// on CI runners ("Unknown command line option: '-i'").
const tailwindBin = `${rootDir}/node_modules/.bin/tailwindcss`
await $`${tailwindBin} -i ${import.meta.dir}/src/styles/globals.css -o ${distDir}/styles.css --minify`.quiet()

console.log("⚡ Bundling client JS...")
await bundleClient({ outdir: distDir, minify: true, define })

console.log("⚡ Bundling API demos + playground...")
const demosBuild = await bundleDemos({
    outdir: distDir,
    minify: true,
    define,
})
if (!demosBuild.success) {
    console.error("Demos build failed:")
    for (const log of demosBuild.logs) console.error(log)
}

console.log("⚡ Bundling landing page islands...")
const landingBuild = await bundleLanding({
    outdir: distDir,
    minify: true,
    define,
})
if (!landingBuild.success) {
    console.error("Landing build failed:")
    for (const log of landingBuild.logs) console.error(log)
}

console.log("📄 Rendering HTML...")
await renderPages(compiled, distDir)

console.log("🤖 Generating llms.txt + per-page markdown...")
await generateLlmsTxt(compiled, distDir, siteUrl)
await generateMarkdownPages(compiled, distDir, siteUrl)

console.log("🗺️ Generating sitemap.xml & robots.txt...")
await generateSitemap(compiled, distDir, siteUrl)

// Copy static assets
await Bun.write(`${distDir}/favicon.svg`, Bun.file(`${import.meta.dir}/favicon.svg`))

console.log("🔎 Indexing for search...")
await $`${rootDir}/node_modules/.bin/pagefind --site ${distDir}`.quiet()

console.log(`✅ Built ${entries.length} pages to docs/dist/`)
