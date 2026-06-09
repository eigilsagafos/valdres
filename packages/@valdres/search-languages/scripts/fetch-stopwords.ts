#!/usr/bin/env bun
/**
 * Fetch and vendor stop-word lists from canonical upstream sources.
 *
 * Run via `bun run scripts/fetch-stopwords.ts` from the package root.
 *
 * Two sources, picked per-language:
 *
 *  - **Snowball** (`snowballstem.org/algorithms/<lang>/stop.txt`) for the
 *    15 languages Snowball ships stopword lists for. Preferred wherever
 *    available: the lists are designed to pair with the matching Snowball
 *    stemmer (which we also use), are curated by linguists with
 *    documented per-word reasoning, and never include content words.
 *
 *  - **stopwords-iso** (https://github.com/stopwords-iso/stopwords-iso,
 *    pinned to v0.4.0) for the 10 languages Snowball doesn't ship lists
 *    for. Aggregated from multiple sources — quality varies by language;
 *    `nepali`, `serbian`, `tamil` are not present and ship empty lists.
 *
 * The generated files are committed to source. End users never run this
 * script.
 */
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const STOPWORDS_ISO_VERSION = "v0.4.0"
const STOPWORDS_ISO_URL = `https://raw.githubusercontent.com/stopwords-iso/stopwords-iso/${STOPWORDS_ISO_VERSION}/stopwords-iso.json`
/** Snowball stopword lists live on the snowball-website repo, not the
 *  compiler repo. Pin by commit SHA — `snowballstem.org/algorithms/...`
 *  serves the live website and has no version in the URL, so the same
 *  URL could return different content between regenerations. */
const SNOWBALL_WEBSITE_COMMIT = "ea94bd3f31367ba6a3d04dfb336af4994b4b511f"
const SNOWBALL_BASE = `https://raw.githubusercontent.com/snowballstem/snowball-website/${SNOWBALL_WEBSITE_COMMIT}/algorithms`

const HERE = dirname(fileURLToPath(import.meta.url))
const PKG_ROOT = join(HERE, "..")
const STOPWORDS_OUT = join(PKG_ROOT, "src/stopwords")

type Source =
    | { kind: "snowball"; lang: string }
    | { kind: "stopwords-iso"; code: string }

/** Per-language source assignment. Snowball wherever we can — same family
 *  as our stemmers. stopwords-iso for the rest. Update both this table
 *  and `NOTICE` when adding a language. */
const LANGUAGES: ReadonlyArray<{ name: string; source: Source }> = [
    { name: "arabic",      source: { kind: "stopwords-iso", code: "ar" } },
    { name: "armenian",    source: { kind: "stopwords-iso", code: "hy" } },
    { name: "danish",      source: { kind: "snowball",      lang: "danish" } },
    { name: "dutch",       source: { kind: "snowball",      lang: "dutch" } },
    { name: "english",     source: { kind: "snowball",      lang: "english" } },
    { name: "finnish",     source: { kind: "snowball",      lang: "finnish" } },
    { name: "french",      source: { kind: "snowball",      lang: "french" } },
    { name: "german",      source: { kind: "snowball",      lang: "german" } },
    { name: "greek",       source: { kind: "stopwords-iso", code: "el" } },
    { name: "hindi",       source: { kind: "stopwords-iso", code: "hi" } },
    { name: "hungarian",   source: { kind: "snowball",      lang: "hungarian" } },
    { name: "indonesian",  source: { kind: "snowball",      lang: "indonesian" } },
    { name: "irish",       source: { kind: "snowball",      lang: "irish" } },
    { name: "italian",     source: { kind: "snowball",      lang: "italian" } },
    { name: "lithuanian",  source: { kind: "stopwords-iso", code: "lt" } },
    { name: "nepali",      source: { kind: "stopwords-iso", code: "ne" } },
    { name: "norwegian",   source: { kind: "snowball",      lang: "norwegian" } },
    { name: "portuguese",  source: { kind: "snowball",      lang: "portuguese" } },
    { name: "romanian",    source: { kind: "stopwords-iso", code: "ro" } },
    { name: "russian",     source: { kind: "snowball",      lang: "russian" } },
    { name: "serbian",     source: { kind: "stopwords-iso", code: "sr" } },
    { name: "spanish",     source: { kind: "snowball",      lang: "spanish" } },
    { name: "swedish",     source: { kind: "snowball",      lang: "swedish" } },
    { name: "tamil",       source: { kind: "stopwords-iso", code: "ta" } },
    { name: "turkish",     source: { kind: "stopwords-iso", code: "tr" } },
]

/** Snowball stop.txt: one word per line, optional `| comment` suffix.
 *  Blank lines and `| comment`-only lines are skipped. Word is the first
 *  token before any `|`. */
const parseSnowballStopwords = (text: string): string[] => {
    const seen = new Set<string>()
    const out: string[] = []
    for (const raw of text.split("\n")) {
        const beforePipe = raw.split("|")[0].trim()
        if (beforePipe.length === 0) continue
        // Defensive — strip anything after whitespace in case the file
        // ever uses multi-word entries (it doesn't today).
        const word = beforePipe.split(/\s+/)[0]
        if (word.length === 0 || seen.has(word)) continue
        seen.add(word)
        out.push(word)
    }
    return out
}

const fetchSnowball = async (lang: string): Promise<string[]> => {
    const res = await fetch(`${SNOWBALL_BASE}/${lang}/stop.txt`)
    if (!res.ok) {
        throw new Error(
            `Failed to fetch Snowball stopwords for ${lang}: ${res.status}`,
        )
    }
    return parseSnowballStopwords(await res.text())
}

const fetchStopwordsIso = async (): Promise<
    Record<string, readonly string[]>
> => {
    const res = await fetch(STOPWORDS_ISO_URL)
    if (!res.ok) {
        throw new Error(`Failed to fetch stopwords-iso: ${res.status}`)
    }
    return (await res.json()) as Record<string, readonly string[]>
}

const headerFor = (
    name: string,
    source: Source,
    found: boolean,
): string => {
    const lines = [
        `// AUTO-GENERATED — DO NOT EDIT. Regenerate via \`bun run scripts/fetch-stopwords.ts\`.`,
    ]
    if (source.kind === "snowball") {
        lines.push(
            `// Source: snowballstem/snowball-website @ ${SNOWBALL_WEBSITE_COMMIT.slice(0, 8)} — algorithms/${source.lang}/stop.txt`,
            `// License: BSD-3-Clause. See NOTICE for attribution.`,
        )
    } else {
        lines.push(
            `// Source: stopwords-iso/stopwords-iso ${STOPWORDS_ISO_VERSION} (code: ${source.code})`,
            `// License: MIT. See NOTICE for attribution.`,
        )
        if (!found) {
            lines.push(
                `// NOTE: ${name} (ISO code: ${source.code}) is not present in stopwords-iso.`,
                `// Empty list. Override per-instance with \`stopWords: yourCustomSet\` if needed.`,
            )
        }
    }
    return lines.join("\n") + "\n"
}

const main = async (): Promise<void> => {
    mkdirSync(STOPWORDS_OUT, { recursive: true })
    console.log(`Fetching stopwords-iso ${STOPWORDS_ISO_VERSION} (one-shot)...`)
    const iso = await fetchStopwordsIso()
    console.log(`Fetching per-language stopwords...`)
    let snowballCount = 0
    let isoCount = 0
    for (const { name, source } of LANGUAGES) {
        let list: readonly string[]
        let found = true
        if (source.kind === "snowball") {
            list = await fetchSnowball(source.lang)
            snowballCount++
        } else {
            list = iso[source.code] ?? []
            found = list.length > 0
            isoCount++
        }
        const body =
            `${headerFor(name, source, found)}\n` +
            `export const stopwords: readonly string[] = ${JSON.stringify(list)}\n`
        writeFileSync(join(STOPWORDS_OUT, `${name}.ts`), body)
        const tag = source.kind === "snowball" ? "S" : found ? "i" : "○"
        console.log(
            `  ${tag} ${name.padEnd(12)} ${String(list.length).padStart(4)} words`,
        )
    }
    console.log(
        `Done. ${snowballCount} from Snowball, ${isoCount} from stopwords-iso.`,
    )
}

void main()
