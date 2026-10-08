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
 * The docs site passes optional status notes (see MdxToMarkdownOptions) so the
 * Markdown twins carry the same legacy notices the rendered pages add; README
 * generation passes none.
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

const PHRASING = new Set(["text", "inlineCode", "emphasis", "strong", "link", "break"])

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
    /** Which <FrameworkBlock fw="..."> to keep (default "react"). */
    keepFramework?: string
    /** Collects names of unknown JSX components that were dropped. */
    onWarn?: (message: string) => void
    /** A titled blockquote inserted right after the page's first `#` heading. */
    pageNotice?: { title: string; body: string }
    /** A paragraph emitted before the kept <FrameworkBlock>'s content. */
    frameworkBlockNote?: string
    /** A paragraph emitted before each <Playground> link. */
    playgroundNote?: string
}

/** Backticks in a note mark inline code. */
function inline(markdown: string): AnyNode[] {
    return markdown
        .split("`")
        .map((part, i) => (i % 2 ? { type: "inlineCode", value: part } : text(part)))
        .filter(node => node.type === "inlineCode" || node.value !== "")
}

function noteParagraph(markdown: string): AnyNode {
    return { type: "paragraph", children: [{ type: "emphasis", children: inline(markdown) }] }
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
            case "FrameworkBlock": {
                // Keep one framework's variant (react unless told otherwise).
                if (getAttr(node, "fw") !== (opts.keepFramework ?? "react")) return null
                const kept = transformNodes(node.children ?? [])
                return opts.frameworkBlockNote
                    ? [noteParagraph(opts.frameworkBlockNote), ...kept]
                    : kept
            }
            case "PluginDemo":
                return opts.liveUrl
                    ? linkParagraph("▶ Live example", opts.liveUrl)
                    : null
            case "Playground": {
                if (!opts.liveUrl) return null
                const link = linkParagraph("▶ Try it live", opts.liveUrl)
                return opts.playgroundNote
                    ? [noteParagraph(opts.playgroundNote), link]
                    : link
            }
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
                // wrapper but keep any real markdown content inside. A div is a
                // block, so inline content it held (the signature box's code and
                // labels) becomes its own paragraph; left inline at block level,
                // it glues the following heading or blockquote onto its line.
                if (getAttr(node, "id")) return null
                return transformNodes(node.children ?? []).map(child =>
                    PHRASING.has(child.type) ? { type: "paragraph", children: [child] } : child,
                )
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
        if (opts.pageNotice) {
            const title = tree.children.findIndex(
                (n: AnyNode) => n.type === "heading" && n.depth === 1,
            )
            tree.children.splice(title + 1, 0, {
                type: "blockquote",
                children: [
                    {
                        type: "paragraph",
                        children: [{ type: "strong", children: [text(opts.pageNotice.title)] }],
                    },
                    { type: "paragraph", children: inline(opts.pageNotice.body) },
                ],
            })
        }
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
