import { Glob } from "bun"
import matter from "gray-matter"
import {
    frameworkFromPackage,
    frameworkList,
    frameworks,
    type Framework,
} from "./frameworks"

export type DocEntry = {
    route: string
    mdxPath: string
    packageName: string
    type: "api" | "guide"
    framework?: Framework
    frontmatter: {
        title: string
        description?: string
    }
}

const packagePatterns = [
    "packages/valdres/src/**/*.mdx",
    "packages/valdres-react/src/**/*.mdx",
    "packages/valdres-vue/src/**/*.mdx",
    "packages/valdres-svelte/src/**/*.mdx",
    "packages/valdres-solid/src/**/*.mdx",
    "packages/valdres-angular/src/**/*.mdx",
    "packages/@valdres/*/src/**/*.mdx",
    "packages/@valdres-react/*/src/**/*.mdx",
]

const guidePattern = "docs/content/guides/**/*.mdx"

export async function discover(rootDir: string): Promise<DocEntry[]> {
    const entries: DocEntry[] = []

    const allPatterns = [...packagePatterns, guidePattern]

    for (const pattern of allPatterns) {
        const glob = new Glob(pattern)
        for await (const path of glob.scan({ cwd: rootDir })) {
            const fullPath = `${rootDir}/${path}`
            const content = await Bun.file(fullPath).text()
            const { data } = matter(content)

            const isGuide = path.startsWith("docs/content/guides/")

            if (isGuide) {
                const guideMatch = path.match(/^docs\/content\/guides\/(.+)\.mdx$/)
                if (guideMatch) {
                    entries.push({
                        route: `/guides/${guideMatch[1]}`,
                        mdxPath: fullPath,
                        packageName: "guides",
                        type: "guide",
                        frontmatter: {
                            title: data.title || guideMatch[1],
                            description: data.description,
                        },
                    })
                }
                continue
            }

            const packageMatch = path.match(
                /^packages\/(@?[^/]+(?:\/[^/]+)?)\/?src\/(.+)\.mdx$/,
            )
            if (!packageMatch) continue

            const packageName = packageMatch[1]
            const filePath = packageMatch[2]
            const framework = frameworkFromPackage(packageName)

            if (framework && framework !== "vanilla") {
                // Framework-specific docs: /<fw>/<name>
                entries.push({
                    route: `/${framework}/${filePath}`,
                    mdxPath: fullPath,
                    packageName,
                    type: "api",
                    framework,
                    frontmatter: {
                        title: data.title || filePath,
                        description: data.description,
                    },
                })
            } else if (packageName === "valdres") {
                // Core valdres docs: expand to one page per non-vanilla framework
                for (const fw of frameworkList) {
                    if (fw === "vanilla") continue
                    entries.push({
                        route: `/${fw}/${filePath}`,
                        mdxPath: fullPath,
                        packageName,
                        type: "api",
                        framework: fw,
                        frontmatter: {
                            title: data.title || filePath,
                            description: data.description,
                        },
                    })
                }
            }
        }
    }

    return entries.sort((a, b) => a.route.localeCompare(b.route))
}
