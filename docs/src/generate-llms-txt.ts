import { mdxToMarkdown } from "../../scripts/lib/mdx-to-markdown"
import type { CompiledDoc } from "./compile-mdx"

// Shared (core/plugin) pages exist once per framework from one MDX source.
// For LLM artifacts we list/emit each source once with its canonical (react)
// URL — five near-identical copies only waste context window.
function dedupeBySource(docs: CompiledDoc[]): CompiledDoc[] {
    const seen = new Set<string>()
    const out: CompiledDoc[] = []
    for (const doc of docs) {
        if (seen.has(doc.mdxPath)) continue
        seen.add(doc.mdxPath)
        out.push(doc)
    }
    return out
}

function entry(doc: CompiledDoc, siteUrl: string): string {
    const desc = doc.frontmatter.description
        ? `: ${doc.frontmatter.description}`
        : ""
    return `- [${doc.frontmatter.title}](${siteUrl}${doc.route}.md)${desc}`
}

export async function generateLlmsTxt(
    docs: CompiledDoc[],
    distDir: string,
    siteUrl: string,
) {
    // Sort so the react variant of each shared source comes first → react
    // becomes the canonical route after dedupe.
    const ordered = [...docs].sort((a, b) => {
        const aReact = a.route.startsWith("/react/") ? 0 : 1
        const bReact = b.route.startsWith("/react/") ? 0 : 1
        return aReact - bReact || a.route.localeCompare(b.route)
    })
    const unique = dedupeBySource(ordered)

    const guides = unique.filter(d => d.type === "guide")
    const core = unique.filter(d => d.type === "api" && d.packageName === "valdres")
    const plugins = unique.filter(d => d.type === "plugin")
    const adapters = unique.filter(
        d => d.type === "api" && d.packageName !== "valdres",
    )

    // llms.txt — organized index. Every link points at the page's markdown
    // twin (same URL + ".md"); the HTML page is at the same URL without it.
    const lines = [
        "# Valdres",
        "",
        "> Reactive state management for React, Vue, Svelte, Solid, and Angular — one store, shared across frameworks. Inspired by Recoil and Jotai. The framework-agnostic core also runs in plain JavaScript, Node, and workers.",
        "",
        "Every documentation page is available as plain markdown at the same URL with `.md` appended (e.g. `/react/atom.md`). Core API and plugin pages are framework-scoped: swap `/react/` for `/vue/`, `/svelte/`, `/solid/`, or `/angular/` to see that framework's variant of the same page.",
        "",
        `- [Complete documentation as one file](${siteUrl}/llms-full.txt)`,
        "",
        "## Guides",
        "",
        ...guides.map(d => entry(d, siteUrl)),
        "",
        "## Core API (framework-agnostic)",
        "",
        ...core.map(d => entry(d, siteUrl)),
        "",
        "## Framework bindings",
        "",
        ...adapters.map(d => entry(d, siteUrl)),
        "",
        "## Plugins (work with every framework)",
        "",
        ...plugins.map(d => entry(d, siteUrl)),
        "",
    ]

    await Bun.write(`${distDir}/llms.txt`, lines.join("\n"))

    // llms-full.txt — full content, each source once, rendered to clean
    // markdown (JSX components resolved/stripped) with its canonical URL.
    const fullLines = [
        "<SYSTEM>This is the full developer documentation for Valdres — reactive state management for React, Vue, Svelte, Solid, and Angular. Shared (core/plugin) pages are included once; they exist per framework at /react/…, /vue/…, /svelte/…, /solid/…, /angular/… with the examples adapted.</SYSTEM>",
        "",
    ]

    for (const doc of unique) {
        const md = mdxToMarkdown(doc.rawContent, {
            liveUrl: `${siteUrl}${doc.route}`,
            keepFramework: doc.framework ?? "react",
        })
        fullLines.push(`Source: ${siteUrl}${doc.route}.md`, "", md.trim(), "", "---", "")
    }

    await Bun.write(`${distDir}/llms-full.txt`, fullLines.join("\n"))
}

// Markdown twin for every route: /react/atom.md next to /react/atom/. Each
// framework variant keeps its own <FrameworkBlock> examples, so agents fetch
// exactly what the HTML page shows, minus the chrome.
export async function generateMarkdownPages(
    docs: CompiledDoc[],
    distDir: string,
    siteUrl: string,
) {
    await Promise.all(
        docs.map(doc =>
            Bun.write(
                `${distDir}${doc.route}.md`,
                mdxToMarkdown(doc.rawContent, {
                    liveUrl: `${siteUrl}${doc.route}`,
                    keepFramework: doc.framework ?? "react",
                }),
            ),
        ),
    )
}
