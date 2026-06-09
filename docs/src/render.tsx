import { renderToString } from "react-dom/server"
import { run } from "@mdx-js/mdx"
import * as runtime from "react/jsx-runtime"
import { RootLayout } from "./layout/RootLayout"
import { LandingPage } from "./layout/LandingPage"
import { BrandTestPage } from "./layout/BrandTestPage"
import { BrandTestPage2 } from "./layout/BrandTestPage2"
import { renderThemeTestPage } from "./layout/ThemeTestPage"
import { getNav, getNavAllFrameworks } from "../content/nav"
import { getFrameworkMap, getEquivalentRoute } from "./framework-map"
import {
    BenchmarkTables,
    categorySlug,
    type BenchSummary,
} from "./components/BenchmarkTables"
import type { CompiledDoc } from "./compile-mdx"
import type { Framework } from "./frameworks"

const PERFORMANCE_ROUTE = "/guides/performance"

const coreApiNames = ["atom", "selector", "atomFamily", "selectorFamily", "store"]

function rewriteLink(href: string, framework: Framework): { href: string; apiName?: string } {
    // Rewrite /valdres/X → /${framework}/X for core API names
    const valdresMatch = href.match(/^\/valdres\/(.+)$/)
    if (valdresMatch && coreApiNames.includes(valdresMatch[1])) {
        return { href: `/${framework}/${valdresMatch[1]}` }
    }

    // Rewrite /react/X or /vue/X etc. → /${framework}/equivalent
    const fwMatch = href.match(/^\/([^/]+)\/(.+)$/)
    if (fwMatch) {
        const sourceFw = fwMatch[1]
        const fwNames = ["react", "vue", "svelte", "solid", "angular"]
        if (fwNames.includes(sourceFw)) {
            if (sourceFw === framework) return { href }
            const equivalent = getEquivalentRoute(href, framework)
            if (equivalent) {
                const newApiName = equivalent.split("/").pop()!
                return { href: equivalent, apiName: newApiName }
            }
        }
    }

    return { href }
}

export async function renderPages(docs: CompiledDoc[], distDir: string) {

    // Benchmark summary (generated from Bencher by scripts/gen-bench-summary.ts).
    // Read once: drives both the landing-page stats and the performance tables.
    let benchSummary: BenchSummary & {
        jscAverage: number | null
        v8Average: number | null
        benchmarkCount: number
    } = {
        jscAverage: null,
        v8Average: null,
        jotaiVersion: "2.19.0",
        date: "",
        benchmarkCount: 28,
        categories: [],
    }
    try {
        const benchFile = await Bun.file(`${distDir}/../content/bench-summary.json`).text()
        benchSummary = { ...benchSummary, ...JSON.parse(benchFile) }
    } catch {}

    // Category headings for the performance page's table of contents — the
    // tables are rendered dynamically, so their <h2>s aren't in the MDX source.
    const benchHeadings = benchSummary.categories.map(c => ({
        id: categorySlug(c.name),
        text: c.name,
        level: 2 as const,
    }))

    // Collect all routes that actually exist so framework maps only reference real pages
    const allRoutes = new Set(docs.map(d => d.route))

    // Build a "first page" map for non-framework pages
    const firstPageMap: Record<string, string | null> = {
        react: null, vue: null, svelte: null, solid: null, angular: null, vanilla: null,
    }
    for (const d of docs) {
        if (d.framework && !firstPageMap[d.framework]) {
            firstPageMap[d.framework] = d.route
        }
    }

    await Promise.all(docs.map(async doc => {
        const { default: MdxContent } = await run(doc.code, {
            ...runtime,
            baseUrl: import.meta.url,
        })

        const framework = doc.framework
        const nav = framework
            ? getNav(framework, docs)
            : getNavAllFrameworks(docs)

        let frameworkMap: Record<string, string | null>
        if (framework) {
            frameworkMap = { ...getFrameworkMap(doc.route) }
            for (const [fw, route] of Object.entries(frameworkMap)) {
                if (route && !allRoutes.has(route)) {
                    ;(frameworkMap as any)[fw] = null
                }
            }
        } else {
            frameworkMap = { ...firstPageMap }
        }

        const Playground = ({ code }: { code: string }) => (
            <div
                data-playground
                data-code={code}
                className="not-prose my-6 py-16 text-center text-sm text-zinc-500 dark:text-zinc-400"
            >
                Loading playground…
            </div>
        )

        const BenchmarkTablesBound = () => <BenchmarkTables summary={benchSummary} />

        // Renders its children only on the matching framework's variant of the
        // page. Since each plugin/core page is a distinct per-framework route,
        // the other frameworks' blocks are never shipped in this route's HTML.
        const FrameworkBlock = ({ fw, children }: { fw: string; children?: any }) =>
            fw === framework ? <>{children}</> : null

        // Placeholder for an interactive plugin demo, hydrated by demos.ts.
        const PluginDemo = ({ plugin }: { plugin: string }) => (
            <div
                data-plugin-demo={plugin}
                className="not-prose my-6 min-h-[3rem] text-sm text-zinc-500 dark:text-zinc-400"
            >
                Loading demo…
            </div>
        )

        const mdxComponents = framework
            ? {
                  a: (props: any) => {
                      if (!props.href) return <a {...props} />
                      const result = rewriteLink(props.href, framework)
                      const children = result.apiName ?? props.children
                      return <a {...props} href={result.href}>{children}</a>
                  },
                  Playground,
                  BenchmarkTables: BenchmarkTablesBound,
                  FrameworkBlock,
                  PluginDemo,
              }
            : { Playground, BenchmarkTables: BenchmarkTablesBound, FrameworkBlock, PluginDemo }

        const headings =
            doc.route === PERFORMANCE_ROUTE
                ? [...benchHeadings, ...doc.headings]
                : doc.headings

        const html = renderToString(
            <RootLayout
                title={doc.frontmatter.title}
                description={doc.frontmatter.description}
                currentRoute={doc.route}
                nav={nav}
                headings={headings}
                framework={framework}
                frameworkMap={frameworkMap}
            >
                <MdxContent components={mdxComponents} />
            </RootLayout>,
        )

        const fullHtml = `<!DOCTYPE html>\n${html}`
        const outPath = `${distDir}${doc.route}/index.html`
        await Bun.write(outPath, fullHtml)
    }))

    // Landing page — reuse the benchmark summary read above for dynamic stats
    const landingHtml = renderToString(
        <LandingPage
            bench={{
                jscAverage: benchSummary.jscAverage,
                v8Average: benchSummary.v8Average,
                jotaiVersion: benchSummary.jotaiVersion,
                benchmarkCount: benchSummary.benchmarkCount,
            }}
        />,
    )
    await Bun.write(
        `${distDir}/index.html`,
        `<!DOCTYPE html>\n${landingHtml}`,
    )

    // Brand test pages
    const brandHtml = renderToString(<BrandTestPage />)
    await Bun.write(
        `${distDir}/brand-test/index.html`,
        `<!DOCTYPE html>\n${brandHtml}`,
    )

    const brand2Html = renderToString(<BrandTestPage2 />)
    await Bun.write(
        `${distDir}/brand-test/wild/index.html`,
        `<!DOCTYPE html>\n${brand2Html}`,
    )

    // Theme comparison page
    const themeHtml = await renderThemeTestPage()
    await Bun.write(`${distDir}/theme-test/index.html`, themeHtml)
}
