import { discover } from "./src/discover"
import { compileMdx } from "./src/compile-mdx"
import { renderPages } from "./src/render"
import { generateLlmsTxt } from "./src/generate-llms-txt"
import { generateSitemap } from "./src/generate-sitemap"
import { $ } from "bun"

const rootDir = import.meta.dir.replace("/docs", "")
const distDir = `${import.meta.dir}/dist`
const siteUrl = "https://valdres.dev"

console.log("🔍 Discovering MDX files...")
const entries = await discover(rootDir)
console.log(`   Found ${entries.length} pages`)

console.log("📝 Compiling MDX...")
const compiled = await compileMdx(entries)

console.log("🎨 Building CSS...")
await $`bunx @tailwindcss/cli -i ${import.meta.dir}/src/styles/globals.css -o ${distDir}/styles.css --minify`.quiet()

console.log("⚡ Bundling client JS...")
await Bun.build({
    entrypoints: [`${import.meta.dir}/src/islands/client.ts`],
    outdir: distDir,
    minify: true,
    naming: "client.js",
})

// Deduplicate React — workspace packages each install their own copy,
// but the browser bundle must use a single shared React instance.
const reactDedup: import("bun").BunPlugin = {
    name: "react-dedup",
    setup(build) {
        const reactPkgs = ["react", "react/jsx-runtime", "react/jsx-dev-runtime", "react-dom", "react-dom/client"]
        for (const pkg of reactPkgs) {
            build.onResolve({ filter: new RegExp(`^${pkg.replace("/", "\\/")}$`) }, () => {
                return { path: require.resolve(pkg) }
            })
        }
    },
}

console.log("⚡ Bundling API demos + playground...")
const demosBuild = await Bun.build({
    entrypoints: [
        `${import.meta.dir}/src/islands/demos.ts`,
        `${import.meta.dir}/src/islands/playground-bundle.tsx`,
    ],
    outdir: distDir,
    minify: true,
    splitting: true,
    naming: { entry: "[name].js" },
    plugins: [reactDedup],
    define: {
        "process.env.NODE_ENV": '"production"',
        "process.env.VALDRES_VERSION": '"0.2.0"',
    },
})
if (!demosBuild.success) {
    console.error("Demos build failed:")
    for (const log of demosBuild.logs) console.error(log)
}

console.log("⚡ Bundling landing page islands...")

const sveltePlugin: import("bun").BunPlugin = {
    name: "svelte",
    async setup(build) {
        const { compile, compileModule } = await import("svelte/compiler")

        // Handle .svelte.ts/.svelte.js module files (Svelte 5 runes in TS/JS)
        // This must come before .svelte to match more specifically
        build.onLoad({ filter: /\.svelte\.[tj]s$/ }, async args => {
            const source = await Bun.file(args.path).text()
            const transpiler = new Bun.Transpiler({ loader: "ts" })
            const jsSource = transpiler.transformSync(source)
            const result = compileModule(jsSource, {
                filename: args.path,
                generate: "client",
            })
            return { contents: result.js.code, loader: "js" }
        })

        // Handle .svelte component files
        build.onLoad({ filter: /\.svelte$/ }, async args => {
            const source = await Bun.file(args.path).text()
            const result = compile(source, {
                filename: args.path,
                generate: "client",
                css: "injected",
            })
            return { contents: result.js.code, loader: "js" }
        })
    },
}

const landingBuild = await Bun.build({
    entrypoints: [`${import.meta.dir}/src/islands/landing.tsx`],
    outdir: distDir,
    minify: true,
    naming: "landing.js",
    plugins: [reactDedup, sveltePlugin],
    define: {
        "process.env.NODE_ENV": '"production"',
        "process.env.VALDRES_VERSION": '"0.2.0"',
    },
})
if (!landingBuild.success) {
    console.error("Landing build failed:")
    for (const log of landingBuild.logs) console.error(log)
}

console.log("📄 Rendering HTML...")
await renderPages(compiled, distDir)

console.log("🤖 Generating llms.txt...")
await generateLlmsTxt(compiled, distDir, siteUrl)

console.log("🗺️ Generating sitemap.xml & robots.txt...")
await generateSitemap(compiled, distDir, siteUrl)

// Copy static assets
await Bun.write(`${distDir}/favicon.svg`, Bun.file(`${import.meta.dir}/favicon.svg`))

console.log("🔎 Indexing for search...")
await $`bunx pagefind --site ${distDir}`.quiet()

console.log(`✅ Built ${entries.length} pages to docs/dist/`)
