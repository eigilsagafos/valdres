/**
 * The generated documentation outputs agree on v1 status: the website pages,
 * their Markdown twins, llms.txt and llms-full.txt. Builds the real pages from
 * every MDX source into a temporary directory with the site's own renderer
 * and generators.
 */
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { mdxToMarkdown } from "../../scripts/lib/mdx-to-markdown"
import { compileMdx, type CompiledDoc } from "../src/compile-mdx"
import { discover } from "../src/discover"
import { generateLlmsTxt, generateMarkdownPages } from "../src/generate-llms-txt"
import {
    isV1Unavailable,
    legacyExampleLabel,
    legacyNoticeTitle,
    legacyPageNotice,
    playgroundLegacyLabel,
    unmigratedAdapter,
} from "../src/legacy-status"
import { renderPages } from "../src/render"

// Compiling and rendering every page takes a few seconds.
setDefaultTimeout(120_000)

const SITE = "https://valdres.dev"
const rootDir = resolve(import.meta.dir, "../..")

let distDir: string
let docs: CompiledDoc[]

beforeAll(async () => {
    distDir = await mkdtemp(join(tmpdir(), "valdres-docs-outputs-"))
    docs = await compileMdx(await discover(rootDir))
    await renderPages(docs, distDir)
    await generateLlmsTxt(docs, distDir, SITE)
    await generateMarkdownPages(docs, distDir, SITE)
})

afterAll(async () => {
    await rm(distDir, { recursive: true, force: true })
})

const read = (path: string) => Bun.file(join(distDir, path)).text()
const html = (route: string) => read(`${route}/index.html`)
const markdown = (route: string) => read(`${route}.md`)

/** Visible text of rendered HTML, enough to compare with the Markdown wording. */
const visibleText = (page: string) =>
    page
        .replace(/<script[\s\S]*?<\/script>/g, "")
        .replace(/<[^>]+>/g, "")
        .replace(/&quot;/g, '"')
        .replace(/&#x27;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")

const count = (haystack: string, needle: string) => haystack.split(needle).length - 1
const withoutBackticks = (text: string) => text.replaceAll("`", "")

/** The llms-full.txt section for one route. */
const fullSection = (full: string, route: string) => {
    const start = full.indexOf(`Source: ${SITE}${route}.md`)
    expect(start).toBeGreaterThan(-1)
    return full.slice(start, full.indexOf("\n---\n", start))
}

test("Markdown outputs keep headings and blockquotes on their own lines", async () => {
    // A block glued onto the previous line stops being a heading or a callout,
    // which is how legacy warnings would silently vanish from the Markdown.
    const outputs = [
        ...(await Promise.all(docs.map(doc => markdown(doc.route)))),
        await read("llms-full.txt"),
    ]
    const glued = outputs.flatMap(md =>
        md.split("\n").filter(line => /[^#\s]#{1,6} \S|[.)`]> \*\*/.test(line) && !line.trimStart().startsWith("|")),
    )
    expect(glued.filter(line => !/^\s*(#|```|    )/.test(line))).toEqual([])
})

describe("pages about an integration not migrated to v1", () => {
    test("every route says so once, in the same words, on the website and in Markdown", async () => {
        const pages = docs.filter(doc => isV1Unavailable(doc.packageName))
        // Plugin pages fan out to five frameworks; adapter pages are one each.
        expect(pages.length).toBeGreaterThan(40)
        for (const doc of pages) {
            if (!isV1Unavailable(doc.packageName)) continue
            const notice = legacyPageNotice(doc.packageName)
            const page = await html(doc.route)
            expect(count(page, `data-legacy-example="${doc.packageName}"`)).toBe(1)
            expect(count(visibleText(page), withoutBackticks(notice))).toBe(1)

            const md = await markdown(doc.route)
            expect(count(md, `> **${legacyNoticeTitle}**`)).toBe(1)
            expect(count(md, `> ${notice}`)).toBe(1)
            // Right under the title, as on the page.
            expect(md.split("\n").slice(0, 4).join("\n")).toBe(
                `# ${doc.frontmatter.title}\n\n> **${legacyNoticeTitle}**\n>`,
            )
        }
    })

    test("llms.txt marks them, and llms-full.txt carries the notice", async () => {
        const index = await read("llms.txt")
        const full = await read("llms-full.txt")
        for (const route of ["/react/plugins/browser-window", "/vue/createValdres", "/svelte/fromState"]) {
            const entry = index.split("\n").find(line => line.includes(`(${SITE}${route}.md)`))
            expect(entry).toContain(`${legacyNoticeTitle} (legacy, pre-v1 API)`)
        }
        expect(fullSection(full, "/react/plugins/browser-window")).toContain(
            `> ${legacyPageNotice("@valdres/browser-window")}`,
        )
        expect(fullSection(full, "/vue/createValdres")).toContain(
            `> ${legacyPageNotice("valdres-vue")}`,
        )
        // A migrated integration is not marked.
        const online = index.split("\n").find(line => line.includes("/react/plugins/browser-online.md"))
        expect(online).not.toContain(legacyNoticeTitle)
    })
})

describe("framework-specific examples", () => {
    const blocks = (doc: CompiledDoc) =>
        count(doc.rawContent, `<FrameworkBlock fw="${doc.framework}"`)

    test("every example for an unmigrated adapter is labelled, on the website and in Markdown", async () => {
        const labelled = docs.filter(doc => doc.framework && unmigratedAdapter(doc.framework) && blocks(doc) > 0)
        expect(labelled.length).toBeGreaterThan(30)
        for (const doc of labelled) {
            const adapter = unmigratedAdapter(doc.framework!)!
            const label = legacyExampleLabel(adapter)
            const page = await html(doc.route)
            expect(count(page, `data-legacy-example="${adapter}"`)).toBe(blocks(doc))
            expect(count(visibleText(page), withoutBackticks(label))).toBe(blocks(doc))
            expect(count(await markdown(doc.route), `_${label}_`)).toBe(blocks(doc))
        }
    })

    test("React examples carry no legacy label", async () => {
        const react = docs.filter(doc => doc.framework === "react" && blocks(doc) > 0)
        expect(react.length).toBeGreaterThan(10)
        for (const doc of react) {
            expect(await html(doc.route)).not.toContain("data-legacy-example=\"valdres-")
            expect(await markdown(doc.route)).not.toContain("Legacy example, not Valdres v1")
        }
    })

    test("a Sandpack playground is labelled in Markdown as on the page", () => {
        const md = mdxToMarkdown('# Page\n\n<Playground code="x" />\n', {
            liveUrl: `${SITE}/react/page`,
            playgroundNote: playgroundLegacyLabel,
        })
        expect(md).toContain(`_${playgroundLegacyLabel}_\n\n▶ Try it live: `)
    })
})

describe("current core atom and selector documentation", () => {
    /** Splits an output at its legacy section: [current v1 API, legacy]. */
    const split = (text: string, marker: string) => {
        const at = text.indexOf(marker)
        expect(at).toBeGreaterThan(-1)
        return [text.slice(0, at), text.slice(at)] as const
    }
    const MD_LEGACY = "\n## Legacy pre-1.0 API\n"

    const claims = {
        atom: ["options.equal", "Object.is", "deepEqual", "never copies or freezes"],
        selector: ["options.equal", "Object.is", "deepEqual", "never copied or frozen"],
    }

    for (const page of ["atom", "selector"] as const) {
        test(`${page}: the v1 API is current, legacy options are kept and labelled`, async () => {
            const [htmlCurrent, htmlLegacy] = split(await html(`/react/${page}`), '<h2 id="legacy-pre-10-api"')
            const outputs = {
                website: [visibleText(htmlCurrent), visibleText(htmlLegacy)],
                markdown: split(await markdown(`/react/${page}`), MD_LEGACY),
                "llms-full.txt": split(fullSection(await read("llms-full.txt"), `/react/${page}`), MD_LEGACY),
            }
            for (const [output, [current, legacy]] of Object.entries(outputs)) {
                for (const claim of claims[page]) {
                    expect(current, `${output}: ${claim}`).toContain(claim)
                }
                for (const unsupported of ["options.mutable", "options.schema", "options.maxAge", "deep-freez", "valdres/equality"]) {
                    expect(current, `${output}: ${unsupported}`).not.toContain(unsupported)
                }
                expect(legacy, output).toContain("Legacy — not in Valdres 1.0")
                expect(legacy, output).toContain("options.mutable")
                expect(legacy, output).toContain("options.schema")
            }
        })
    }

    test("atom: values are shared by reference and set, update and atom(fn) are distinct", async () => {
        const [current] = split(await markdown("/react/atom"), MD_LEGACY)
        expect(current).toContain("It never copies or freezes\nvalues, in development or production.")
        expect(current).toContain("`atom(() => 0)` holds the function itself")
        expect(current).toContain("`store.set(atom, value)` stores `value` and never calls it")
        expect(current).toContain("`store.update(atom, updater)` calls `updater`")
        expect(current).toContain("atom.lazy")
    })

    test("the compatibility guide makes no deep-equality or freezing claim", async () => {
        const md = await markdown("/guides/compatibility")
        expect(md).not.toContain("Deep drop-equal is the default")
        expect(md).not.toContain("deep-freezing")
        expect(md).toContain("`Object.is` is the default equality")
    })
})
