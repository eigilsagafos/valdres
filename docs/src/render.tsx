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
import type { CompiledDoc } from "./compile-mdx"
import type { Framework } from "./frameworks"

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

    for (const doc of docs) {
        const { default: MdxContent } = await run(doc.code, {
            ...runtime,
            baseUrl: import.meta.url,
        })

        const framework = doc.framework
        const nav = framework
            ? getNav(framework, docs)
            : getNavAllFrameworks(docs)

        // Build framework map
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

        // Custom link component that rewrites cross-framework links
        const mdxComponents = framework
            ? {
                  a: (props: any) => {
                      if (!props.href) return <a {...props} />
                      const result = rewriteLink(props.href, framework)
                      const children = result.apiName ?? props.children
                      return <a {...props} href={result.href}>{children}</a>
                  },
              }
            : undefined

        const html = renderToString(
            <RootLayout
                title={doc.frontmatter.title}
                description={doc.frontmatter.description}
                currentRoute={doc.route}
                nav={nav}
                headings={doc.headings}
                framework={framework}
                frameworkMap={frameworkMap}
            >
                <MdxContent components={mdxComponents} />
            </RootLayout>,
        )

        const fullHtml = `<!DOCTYPE html>\n${html}`
        const outPath = `${distDir}${doc.route}/index.html`
        await Bun.write(outPath, fullHtml)

    }

    // Landing page — read benchmark summary for dynamic stats
    let benchData = { jscAverage: null as number | null, v8Average: null as number | null, jotaiVersion: "2.19.0", benchmarkCount: 18 }
    try {
        const benchFile = await Bun.file(`${distDir}/../content/bench-summary.json`).text()
        const parsed = JSON.parse(benchFile)
        benchData = { jscAverage: parsed.jscAverage, v8Average: parsed.v8Average, jotaiVersion: parsed.jotaiVersion, benchmarkCount: parsed.benchmarkCount }
    } catch {}
    const landingHtml = renderToString(<LandingPage bench={benchData} />)
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
