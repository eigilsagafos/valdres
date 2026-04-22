import { compile } from "@mdx-js/mdx"
import remarkGfm from "remark-gfm"
import remarkFrontmatter from "remark-frontmatter"
import remarkMdxFrontmatter from "remark-mdx-frontmatter"
import rehypeShiki from "@shikijs/rehype"
import rehypeSlug from "rehype-slug"
import type { DocEntry } from "./discover"
import type { TocItem } from "./layout/TableOfContents"

export type CompiledDoc = DocEntry & {
    code: string
    rawContent: string
    headings: TocItem[]
}

function extractHeadings(source: string): TocItem[] {
    const headings: TocItem[] = []
    const lines = source.split("\n")
    let inCodeBlock = false

    for (const line of lines) {
        if (line.trim().startsWith("```")) {
            inCodeBlock = !inCodeBlock
            continue
        }
        if (inCodeBlock) continue

        const match = line.match(/^(#{2,3})\s+(.+)$/)
        if (match) {
            const text = match[2].replace(/\*\*(.+?)\*\*/g, "$1").trim()
            const id = text
                .toLowerCase()
                .replace(/[^\w\s-]/g, "")
                .replace(/\s+/g, "-")
            headings.push({
                id,
                text,
                level: match[1].length,
            })
        }
    }

    return headings
}

export async function compileMdx(
    entries: DocEntry[],
): Promise<CompiledDoc[]> {
    const results: CompiledDoc[] = []

    for (const entry of entries) {
        const source = await Bun.file(entry.mdxPath).text()

        const compiled = await compile(source, {
            outputFormat: "function-body",
            remarkPlugins: [
                remarkGfm,
                remarkFrontmatter,
                remarkMdxFrontmatter,
            ],
            rehypePlugins: [
                rehypeSlug,
                [
                    rehypeShiki,
                    {
                        theme: "github-dark",
                    },
                ],
            ],
        })

        results.push({
            ...entry,
            code: String(compiled),
            rawContent: source,
            headings: extractHeadings(source),
        })
    }

    return results
}
