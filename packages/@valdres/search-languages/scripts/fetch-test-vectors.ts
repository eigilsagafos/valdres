#!/usr/bin/env bun
/**
 * Sample reference test vectors from `snowballstem/snowball-data` for the
 * Snowball-parity test. For each language with upstream test data, we
 * pick N evenly-spaced (input, expected-stem) pairs and write them to
 * `test/fixtures/<lang>.ts`.
 *
 * Run via `bun run scripts/fetch-test-vectors.ts` from the package root.
 *
 * Why a sample, not the full set: the upstream files are 20k–440k lines
 * per language. Vendoring all of them would balloon the repo. A small
 * evenly-spaced sample is enough to catch the bugs this test is for:
 * build-script regressions, encoding issues, accidental edits to the
 * generated stemmer. We trust Snowball's correctness; we're verifying
 * our pipeline preserves it.
 *
 * Arabic has no test data in snowball-data — fixture is skipped.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { $ } from "bun"

/** Pinned at a commit of snowball-data so re-running this script gives
 *  reproducible output. Pick a commit dated close to Snowball v3.0.1's
 *  release (2025-05-09) so the recorded `output.txt` reflects what our
 *  v3.0.1-compiled stemmers actually produce. snowball-data ships no
 *  release tags — pin by commit SHA. */
const SNOWBALL_DATA_REPO = "https://github.com/snowballstem/snowball-data"
const SNOWBALL_DATA_COMMIT = "381b447563f9bef87b218ebbedde3159afdc3032"
const SAMPLE_SIZE = 100

const HERE = dirname(fileURLToPath(import.meta.url))
const PKG_ROOT = join(HERE, "..")
const FIXTURES_OUT = join(PKG_ROOT, "test/fixtures")
const WORK_DIR = join(PKG_ROOT, ".snowball-data-build")

/** Languages we ship presets for. Arabic isn't in snowball-data — we
 *  skip its fixture and the parity test simply omits it. */
const LANGUAGES: ReadonlyArray<string> = [
    "armenian", "danish", "dutch", "english", "finnish", "french",
    "german", "greek", "hindi", "hungarian", "indonesian", "irish",
    "italian", "lithuanian", "nepali", "norwegian", "portuguese",
    "romanian", "russian", "serbian", "spanish", "swedish", "tamil",
    "turkish",
]

/** Pick N evenly-spaced indices from [0, totalCount). Floor-rounding —
 *  we don't need uniform statistical sampling, just a deterministic
 *  spread across the file. */
const pickIndices = (totalCount: number, n: number): number[] => {
    if (totalCount <= n) {
        return Array.from({ length: totalCount }, (_, i) => i)
    }
    const step = totalCount / n
    const out: number[] = []
    for (let i = 0; i < n; i++) out.push(Math.floor(i * step))
    return out
}

const cloneRepo = async (): Promise<string> => {
    if (existsSync(WORK_DIR)) rmSync(WORK_DIR, { recursive: true, force: true })
    mkdirSync(WORK_DIR, { recursive: true })
    const dir = join(WORK_DIR, "snowball-data")
    // snowball-data doesn't tag releases, so pin by commit SHA. Clone
    // shallow, fetch the specific commit, check it out.
    await $`git clone --no-checkout ${SNOWBALL_DATA_REPO} ${dir}`.quiet()
    await $`git -C ${dir} checkout ${SNOWBALL_DATA_COMMIT}`.quiet()
    return dir
}

const buildFixture = (
    lang: string,
    voc: string,
    out: string,
): { count: number; body: string } => {
    const vocLines = voc.split("\n")
    const outLines = out.split("\n")
    // Trim trailing newlines.
    while (vocLines.length > 0 && vocLines[vocLines.length - 1] === "")
        vocLines.pop()
    while (outLines.length > 0 && outLines[outLines.length - 1] === "")
        outLines.pop()
    if (vocLines.length !== outLines.length) {
        throw new Error(
            `${lang}: voc/output length mismatch (${vocLines.length} vs ${outLines.length})`,
        )
    }
    // Filter to entries our splitter would treat as a single token. Snowball's
    // voc.txt includes elision-style entries (Italian `dell'entroterra`,
    // Norwegian `11'er`) which `snowball-data` generated with extra
    // preprocessing that the bare stemmer doesn't replicate — our splitter
    // breaks these into separate tokens before stemming, so the test would
    // be testing an artificial scenario. Keep only entries that look like a
    // single token: no apostrophes, no internal hyphens, non-empty.
    const filteredIndices: number[] = []
    for (let i = 0; i < vocLines.length; i++) {
        const w = vocLines[i]
        if (w.length === 0) continue
        if (w.includes("'") || w.includes("’")) continue
        if (w.includes("-")) continue
        filteredIndices.push(i)
    }
    if (filteredIndices.length === 0) {
        throw new Error(`${lang}: no usable pairs after filtering`)
    }
    const sample = pickIndices(filteredIndices.length, SAMPLE_SIZE)
    const pairs: [string, string][] = sample.map(j => {
        const i = filteredIndices[j]
        return [vocLines[i], outLines[i]]
    })
    const body =
        `// AUTO-GENERATED from snowballstem/snowball-data — DO NOT EDIT.
// Regenerate via \`bun run scripts/fetch-test-vectors.ts\`.
// Source: snowball-data/${lang}/voc.txt + output.txt (${SAMPLE_SIZE}-line evenly-spaced sample of ${vocLines.length} pairs)
// License: BSD-3-Clause. See NOTICE for attribution.

/** [input, expected-stem] pairs sampled from the canonical Snowball
 *  reference test vectors. */
export const pairs: ReadonlyArray<readonly [string, string]> = ${JSON.stringify(pairs, null, 4)}
`
    return { count: pairs.length, body }
}

const main = async (): Promise<void> => {
    console.log(`Cloning snowballstem/snowball-data...`)
    const repoDir = await cloneRepo()
    mkdirSync(FIXTURES_OUT, { recursive: true })
    let written = 0
    for (const lang of LANGUAGES) {
        const vocPath = join(repoDir, lang, "voc.txt")
        const outPath = join(repoDir, lang, "output.txt")
        if (!existsSync(vocPath) || !existsSync(outPath)) {
            console.log(`  - ${lang.padEnd(12)} (no test data)`)
            continue
        }
        const { count, body } = buildFixture(
            lang,
            readFileSync(vocPath, "utf8"),
            readFileSync(outPath, "utf8"),
        )
        writeFileSync(join(FIXTURES_OUT, `${lang}.ts`), body)
        console.log(`  + ${lang.padEnd(12)} ${count} pairs`)
        written++
    }
    console.log("Cleaning up...")
    rmSync(WORK_DIR, { recursive: true, force: true })
    console.log(`Done. ${written} fixtures written to test/fixtures/.`)
}

void main()
