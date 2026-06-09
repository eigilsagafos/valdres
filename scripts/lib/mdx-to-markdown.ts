/**
 * Convert a docs MDX file into GitHub-flavored Markdown suitable for a package
 * README. The docs site uses a small, known set of JSX components and a few
 * raw `<div>` patterns; this walks the mdast and converts each one explicitly:
 *
 *   <FrameworkBlock fw="react">…</FrameworkBlock>  → keep the React block, drop others
 *   <PluginDemo plugin="x" />                      → "▶ Live example: <url>"
 *   <Playground code={…} />                        → "▶ Try it live: <url>"
 *   <BenchmarkTables />                            → link to the performance page
 *   <div className="callout callout-*">…</div>     → blockquote with a bold title
 *   <div id="api-demo"/> / <div id="cache-demo"/>  → dropped
 *   any other JSX element                          → dropped (with a warning)
 *
 * Frontmatter and MDX import/export/expression nodes are stripped. Site-absolute
 * links (/react/…, /guides/…, /valdres/…) are rewritten to absolute URLs.
 */
import { unified } from "unified"
import remarkParse from "remark-parse"
import remarkMdx from "remark-mdx"
import remarkGfm from "remark-gfm"
import remarkFrontmatter from "remark-frontmatter"
import remarkStringify from "remark-stringify"
import { visit } from "unist-util-visit"

const SITE = "https://valdres.dev"

type AnyNode = { type: string; name?: string; children?: AnyNode[]; [k: string]: any }

function getAttr(node: AnyNode, name: string): string | undefined {
    for (const attr of node.attributes ?? []) {
        if (attr.type === "mdxJsxAttribute" && attr.name === name) {
            return typeof attr.value === "string" ? attr.value : undefined
        }
    }
    return undefined
}

function text(value: string): AnyNode {
    return { type: "text", value }
}

function linkParagraph(label: string, url: string): AnyNode {
    return {
        type: "paragraph",
        children: [text(`${label}: `), { type: "link", url, children: [text(url)] }],
    }
}

function classList(node: AnyNode): string[] {
    return (getAttr(node, "className") ?? "").split(/\s+/).filter(Boolean)
}

export type MdxToMarkdownOptions = {
    /** URL of the live page, used for <PluginDemo> / <Playground> links. */
    liveUrl?: string
    /** Collects names of unknown JSX components that were dropped. */
    onWarn?: (message: string) => void
}

function makeTransform(opts: MdxToMarkdownOptions) {
    const warn = opts.onWarn ?? (() => {})

    function transformNodes(nodes: AnyNode[]): AnyNode[] {
        const out: AnyNode[] = []
        for (const node of nodes) {
            const result = transformNode(node)
            if (Array.isArray(result)) out.push(...result)
            else if (result) out.push(result)
        }
        return out
    }

    function transformNode(node: AnyNode): AnyNode | AnyNode[] | null {
        switch (node.type) {
            case "yaml":
            case "toml":
            case "mdxjsEsm":
            case "mdxFlowExpression":
            case "mdxTextExpression":
                return null
            case "mdxJsxFlowElement":
            case "mdxJsxTextElement":
                return handleJsx(node)
            default:
                if (Array.isArray(node.children)) {
                    node.children = transformNodes(node.children)
                }
                return node
        }
    }

    function handleJsx(node: AnyNode): AnyNode | AnyNode[] | null {
        switch (node.name) {
            case "FrameworkBlock":
                // READMEs show the React variant (the common case); drop others.
                return getAttr(node, "fw") === "react"
                    ? transformNodes(node.children ?? [])
                    : null
            case "PluginDemo":
                return opts.liveUrl
                    ? linkParagraph("▶ Live example", opts.liveUrl)
                    : null
            case "Playground":
                return opts.liveUrl
                    ? linkParagraph("▶ Try it live", opts.liveUrl)
                    : null
            case "BenchmarkTables":
                return linkParagraph(
                    "Benchmarks",
                    `${SITE}/guides/performance`,
                )
            case "code":
                // Inline <code>x</code> used inside callouts → markdown inline code.
                return { type: "inlineCode", value: plainText(node) }
            case "a": {
                const href = getAttr(node, "href")
                const kids = transformNodes(node.children ?? [])
                if (!href) return kids
                return { type: "link", url: href, children: kids }
            }
            case "br":
                return { type: "break" }
            case "strong":
            case "b":
                return { type: "strong", children: transformNodes(node.children ?? []) }
            case "em":
            case "i":
                return { type: "emphasis", children: transformNodes(node.children ?? []) }
            case "div": {
                const classes = classList(node)
                if (classes.includes("callout")) return calloutToBlockquote(node)
                // api-demo / cache-demo placeholders and other bare divs: drop the
                // wrapper but keep any real markdown content inside.
                if (getAttr(node, "id")) return null
                return transformNodes(node.children ?? [])
            }
            default:
                if (node.name) warn(`dropped unknown JSX element <${node.name}>`)
                return transformNodes(node.children ?? [])
        }
    }

    // The callout-title element may be wrapped in a paragraph, so search the
    // whole subtree, capture its text, and strip it out.
    function stripCalloutTitle(node: AnyNode): string {
        let title = ""
        const walk = (n: AnyNode) => {
            if (!Array.isArray(n.children)) return
            n.children = n.children.filter(child => {
                const isTitle =
                    (child.type === "mdxJsxFlowElement" ||
                        child.type === "mdxJsxTextElement") &&
                    child.name === "div" &&
                    classList(child).includes("callout-title")
                if (isTitle) {
                    title = plainText(child)
                    return false
                }
                walk(child)
                return true
            })
        }
        walk(node)
        return title
    }

    function calloutToBlockquote(node: AnyNode): AnyNode {
        const title = stripCalloutTitle(node)
        const body = transformNodes(node.children ?? []).filter(
            n => !(n.type === "paragraph" && (n.children ?? []).length === 0),
        )
        const blockquoteChildren: AnyNode[] = []
        if (title) {
            blockquoteChildren.push({
                type: "paragraph",
                children: [{ type: "strong", children: [text(title)] }],
            })
        }
        blockquoteChildren.push(...body)
        return { type: "blockquote", children: blockquoteChildren }
    }

    function plainText(node: AnyNode): string {
        if (node.type === "text") return node.value as string
        return (node.children ?? []).map(plainText).join("")
    }

    return (tree: AnyNode) => {
        tree.children = transformNodes(tree.children ?? [])
        visit(tree, "link", (n: AnyNode) => {
            if (typeof n.url === "string" && n.url.startsWith("/")) {
                n.url = SITE + n.url
            }
        })
    }
}

export function mdxToMarkdown(
    mdx: string,
    opts: MdxToMarkdownOptions = {},
): string {
    const file = unified()
        .use(remarkParse)
        .use(remarkFrontmatter, ["yaml"])
        .use(remarkMdx)
        .use(remarkGfm)
        .use(() => makeTransform(opts))
        .use(remarkStringify, {
            bullet: "-",
            emphasis: "_",
            strong: "*",
            fence: "`",
            fences: true,
            listItemIndent: "one",
            rule: "-",
        })
        .processSync(mdx)
    return String(file).trim() + "\n"
}
