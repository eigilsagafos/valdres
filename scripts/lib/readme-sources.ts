/**
 * Discovers every publishable package and maps it to its README source.
 *
 * Two modes:
 *   - "doc"   : the package has a single co-located docs MDX (every @valdres/*
 *               plugin). Its README is that page rendered to Markdown.
 *   - "index" : core, the framework adapters, and the @valdres-react/* packages.
 *               Their docs span many pages, so the README is a short, templated
 *               stub that points at valdres.dev.
 */
import { Glob } from "bun"

const SITE = "https://valdres.dev"

export type PackageInfo = {
    name: string
    dir: string
    description: string
    peerDeps: string[]
    mode: "doc" | "index"
    /** doc mode: the co-located MDX to render. */
    mdxPath?: string
    /** doc mode: the live page (for <PluginDemo>/<Playground> links). */
    liveUrl?: string
    /** Footer "Full documentation" target. */
    docUrl: string
}

async function firstMdx(dir: string): Promise<string | undefined> {
    for await (const rel of new Glob("src/**/*.mdx").scan({ cwd: dir })) {
        return `${dir}/${rel}`
    }
    return undefined
}

export async function discoverPackages(rootDir: string): Promise<PackageInfo[]> {
    const patterns = [
        "packages/*/package.json",
        "packages/@valdres/*/package.json",
        "packages/@valdres-react/*/package.json",
    ]
    const seen = new Set<string>()
    const out: PackageInfo[] = []

    for (const pattern of patterns) {
        for await (const rel of new Glob(pattern).scan({ cwd: rootDir })) {
            const full = `${rootDir}/${rel}`
            if (seen.has(full)) continue
            seen.add(full)
            const pkg = JSON.parse(await Bun.file(full).text())
            if (pkg.private) continue

            const name: string = pkg.name
            const dir = full.replace(/\/package\.json$/, "")
            const peerDeps = Object.keys(pkg.peerDependencies ?? {})

            let mode: "doc" | "index" = "index"
            let mdxPath: string | undefined
            let liveUrl: string | undefined
            let docUrl = SITE

            if (name.startsWith("@valdres/")) {
                const short = name.slice("@valdres/".length)
                const mdx = await firstMdx(dir)
                if (mdx) {
                    mode = "doc"
                    mdxPath = mdx
                    liveUrl = `${SITE}/react/plugins/${short}`
                    docUrl = liveUrl
                }
            } else if (name === "@valdres-react/jotai") {
                docUrl = `${SITE}/guides/migration`
            } else if (name === "@valdres-react/recoil") {
                docUrl = `${SITE}/guides/migration`
            }

            out.push({ name, dir, description: pkg.description ?? "", peerDeps, mode, mdxPath, liveUrl, docUrl })
        }
    }

    return out.sort((a, b) => a.name.localeCompare(b.name))
}
