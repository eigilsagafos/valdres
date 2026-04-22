import matter from "gray-matter"
import type { CompiledDoc } from "./compile-mdx"

export async function generateLlmsTxt(
    docs: CompiledDoc[],
    distDir: string,
    siteUrl: string,
) {
    // llms.txt — index with links
    const lines = [
        "# Valdres",
        "",
        "> Fast atom-based state library for React and JavaScript. Inspired by Recoil and Jotai with an emphasis on performance.",
        "",
        "## Documentation",
        "",
        `- [Complete documentation](${siteUrl}/llms-full.txt): the full documentation for Valdres`,
        "",
        "## Pages",
        "",
    ]

    for (const doc of docs) {
        const desc = doc.frontmatter.description
            ? `: ${doc.frontmatter.description}`
            : ""
        lines.push(
            `- [${doc.frontmatter.title}](${siteUrl}${doc.route})${desc}`,
        )
    }

    await Bun.write(`${distDir}/llms.txt`, lines.join("\n"))

    // llms-full.txt — full content concatenated
    const fullLines = [
        "<SYSTEM>This is the full developer documentation for Valdres</SYSTEM>",
        "",
    ]

    for (const doc of docs) {
        const { content } = matter(doc.rawContent)
        fullLines.push(`# ${doc.frontmatter.title}`, "", content.trim(), "", "---", "")
    }

    await Bun.write(`${distDir}/llms-full.txt`, fullLines.join("\n"))
}
