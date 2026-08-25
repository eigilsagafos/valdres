import { dirname } from "node:path"

/**
 * One definition of how the docs site's browser bundles are built, shared by
 * `docs/build.ts` (production), `docs/dev.ts` (watch mode), and
 * `scripts/check-docs-islands.ts` (the CI gate that evaluates them).
 *
 * The gate only means something if it bundles what the site ships, so the
 * bundler config lives here rather than being copy-pasted per caller — the
 * plugins were previously duplicated between build.ts and dev.ts.
 */

const docsDir = dirname(import.meta.dir)

export const readValdresVersion = async (rootDir: string): Promise<string> =>
    (await Bun.file(`${rootDir}/packages/valdres/package.json`).json()).version

/**
 * Every island bundles valdres from workspace SOURCE — `packages/valdres`'s
 * `exports` points at `src/index.ts`, and prepack swaps in the dist paths only
 * for the published tarball. So the islands have to supply the defines the
 * package's own build supplies (`packages/valdres/build.ts`); nothing else does
 * it for them.
 *
 * `VALDRES_ENGINE_SELF_CHECKS` is the load-bearing one. valdres's engine
 * self-checks read it inline so the branches fold to constants, which means
 * without the define the raw `process.env` read reaches the browser — where
 * `process` does not exist. That threw on module load and took every demo on
 * the site down. With it, the demos run what consumers run: self-checks
 * compiled out.
 */
export const islandDefine = (
    valdresVersion: string,
    nodeEnv: "production" | "development",
) => ({
    "process.env.NODE_ENV": JSON.stringify(nodeEnv),
    "process.env.VALDRES_VERSION": JSON.stringify(valdresVersion),
    "process.env.VALDRES_ENGINE_SELF_CHECKS": JSON.stringify("off"),
})

// Deduplicate React — workspace packages each install their own copy,
// but the browser bundle must use a single shared React instance.
export const reactDedup: import("bun").BunPlugin = {
    name: "react-dedup",
    setup(build) {
        const reactPkgs = [
            "react",
            "react/jsx-runtime",
            "react/jsx-dev-runtime",
            "react-dom",
            "react-dom/client",
        ]
        for (const pkg of reactPkgs) {
            build.onResolve(
                { filter: new RegExp(`^${pkg.replace("/", "\\/")}$`) },
                () => {
                    return { path: require.resolve(pkg) }
                },
            )
        }
    },
}

export const sveltePlugin: import("bun").BunPlugin = {
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

type IslandBuildOptions = {
    outdir: string
    minify: boolean
    define: Record<string, string>
}

/** `client.js` — island loader only: no framework, no valdres, no defines. */
export const bundleClient = ({ outdir, minify }: IslandBuildOptions) =>
    Bun.build({
        entrypoints: [`${docsDir}/src/islands/client.ts`],
        outdir,
        minify,
        naming: "client.js",
    })

/** `demos.js` + `playground-bundle.js` — the API/plugin demos on every page. */
export const bundleDemos = ({ outdir, minify, define }: IslandBuildOptions) =>
    Bun.build({
        entrypoints: [
            `${docsDir}/src/islands/demos.ts`,
            `${docsDir}/src/islands/playground-bundle.tsx`,
        ],
        outdir,
        minify,
        splitting: true,
        naming: { entry: "[name].js" },
        plugins: [reactDedup],
        define,
    })

/** `landing.js` — the home page's per-framework islands (React/Vue/Svelte/…). */
export const bundleLanding = ({ outdir, minify, define }: IslandBuildOptions) =>
    Bun.build({
        entrypoints: [`${docsDir}/src/islands/landing.tsx`],
        outdir,
        minify,
        naming: "landing.js",
        plugins: [reactDedup, sveltePlugin],
        define,
    })

/** Bundle names the site loads with a `<script>` tag, in load order. */
export const islandEntryNames = [
    "client.js",
    "demos.js",
    "landing.js",
    "playground-bundle.js",
] as const

export const bundleAllIslands = async (options: IslandBuildOptions) => {
    const results = await Promise.all([
        bundleClient(options),
        bundleDemos(options),
        bundleLanding(options),
    ])
    return results
}
