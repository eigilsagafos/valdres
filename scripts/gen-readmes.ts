/**
 * Generates a README.md for every publishable package from its co-located docs
 * MDX (plugins) or a short template (core / adapters / react bindings).
 *
 *   bun run scripts/gen-readmes.ts          # write READMEs
 *   bun run scripts/gen-readmes.ts --check  # fail if any README is out of date (CI)
 *
 * Generated content lives between <!-- DOCS:START --> / <!-- DOCS:END -->, so any
 * prose a maintainer adds outside the markers is preserved. A README that has
 * substantial hand-written content but no markers is left untouched.
 *
 * No `files`-field change is needed: npm always includes a package's root
 * README.md in the tarball regardless of the `files` allowlist.
 */
import { discoverPackages, type PackageInfo } from "./lib/readme-sources"
import { mdxToMarkdown } from "./lib/mdx-to-markdown"

const ROOT = `${import.meta.dir}/..`
const START = "<!-- DOCS:START -->"
const END = "<!-- DOCS:END -->"

function installSnippet(pkg: PackageInfo): string {
    const parts = [pkg.name, ...pkg.peerDeps.filter(p => p !== pkg.name)]
    return ["```bash", `npm install ${parts.join(" ")}`, "```"].join("\n")
}

const CORE_EXAMPLE = [
    "```ts",
    'import { store, atom, selector } from "valdres"',
    "",
    "const countAtom = atom(0)",
    "const doubledSelector = selector(get => get(countAtom) * 2)",
    "",
    "const s = store()",
    "s.set(countAtom, 21)",
    "s.get(doubledSelector) // 42",
    "```",
].join("\n")

function indexBody(pkg: PackageInfo): string {
    const lines = [`# ${pkg.name}`, ""]
    if (pkg.description) lines.push(pkg.description, "")
    lines.push("## Installation", "", installSnippet(pkg), "")
    if (pkg.name === "valdres") lines.push(CORE_EXAMPLE, "")
    lines.push(
        "Part of [Valdres](https://valdres.dev) — reactive state management for React, Vue, Svelte, Solid, and Angular.",
        "",
        `Full documentation: ${pkg.docUrl}`,
    )
    return lines.join("\n")
}

async function docBody(pkg: PackageInfo): Promise<string> {
    const mdx = await Bun.file(pkg.mdxPath!).text()
    const warnings: string[] = []
    const md = mdxToMarkdown(mdx, { liveUrl: pkg.liveUrl, onWarn: m => warnings.push(m) })
    for (const w of warnings) console.warn(`  ${pkg.name}: ${w}`)
    return `${md.trim()}\n\n---\n\nFull documentation: ${pkg.docUrl}`
}

function splice(existing: string | null, generated: string): string | null {
    const block = `${START}\n\n${generated}\n\n${END}\n`
    if (existing) {
        const i = existing.indexOf(START)
        const j = existing.indexOf(END)
        if (i !== -1 && j !== -1) {
            return existing.slice(0, i) + block.trimEnd() + existing.slice(j + END.length)
        }
        // No markers but real hand-written content → don't clobber.
        if (existing.trim().length > 240) return null
    }
    return block
}

async function main() {
    const check = process.argv.includes("--check")
    const packages = await discoverPackages(ROOT)

    let written = 0
    const skipped: string[] = []
    const stale: string[] = []

    for (const pkg of packages) {
        const generated =
            pkg.mode === "doc" ? await docBody(pkg) : indexBody(pkg)
        const readmePath = `${pkg.dir}/README.md`
        const existing = (await Bun.file(readmePath).exists())
            ? await Bun.file(readmePath).text()
            : null
        const next = splice(existing, generated)

        if (next === null) {
            skipped.push(pkg.name)
            continue
        }
        if (existing === next) continue

        if (check) {
            stale.push(pkg.name)
        } else {
            await Bun.write(readmePath, next)
            written++
        }
    }

    if (skipped.length) {
        console.log(
            `Skipped (hand-written README, no markers): ${skipped.join(", ")}`,
        )
    }

    if (check) {
        if (stale.length) {
            console.error(
                `README out of date for: ${stale.join(", ")}\nRun: bun run scripts/gen-readmes.ts`,
            )
            process.exit(1)
        }
        console.log(`All ${packages.length} package READMEs are up to date.`)
    } else {
        console.log(
            `Generated READMEs: ${written} updated, ${packages.length} packages total.`,
        )
    }
}

await main()
