#!/usr/bin/env bun
/**
 * Regenerate per-language stemmer modules from upstream Snowball source.
 *
 * Run via `bun run scripts/build-stemmers.ts` from the package root.
 *
 * What this does:
 *
 *  1. Clones snowballstem/snowball at a pinned tag into a temp dir.
 *  2. Builds the C snowball compiler (`make`).
 *  3. For each language in LANGUAGES, runs the compiler to produce a
 *     JS stemmer, then post-processes it into a typed ESM module
 *     (`src/stemmers/<lang>.ts`).
 *  4. Vendors the runtime `base-stemmer.js` from upstream as a typed
 *     ESM module (`src/stemmers/base-stemmer.ts`).
 *
 * The generated files are committed to source. End users of the package
 * never run this script — it only matters when we want to refresh the
 * stemmers (Snowball releases new versions occasionally).
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { $ } from "bun"

const SNOWBALL_VERSION = "v3.0.1"
const SNOWBALL_REPO = "https://github.com/snowballstem/snowball"

const HERE = dirname(fileURLToPath(import.meta.url))
const PKG_ROOT = join(HERE, "..")
const STEMMERS_OUT = join(PKG_ROOT, "src/stemmers")
const WORK_DIR = join(PKG_ROOT, ".snowball-build")

/** Snowball source filename → camelCase class name. The class name is
 *  baked into the generated module so we set it explicitly via `-n`. */
const LANGUAGES: ReadonlyArray<{ algo: string; out: string; cls: string }> = [
    { algo: "arabic",      out: "arabic",      cls: "ArabicStemmer"      },
    { algo: "armenian",    out: "armenian",    cls: "ArmenianStemmer"    },
    { algo: "danish",      out: "danish",      cls: "DanishStemmer"      },
    { algo: "dutch",       out: "dutch",       cls: "DutchStemmer"       },
    { algo: "english",     out: "english",     cls: "EnglishStemmer"     },
    { algo: "finnish",     out: "finnish",     cls: "FinnishStemmer"     },
    { algo: "french",      out: "french",      cls: "FrenchStemmer"      },
    { algo: "german",      out: "german",      cls: "GermanStemmer"      },
    { algo: "greek",       out: "greek",       cls: "GreekStemmer"       },
    { algo: "hindi",       out: "hindi",       cls: "HindiStemmer"       },
    { algo: "hungarian",   out: "hungarian",   cls: "HungarianStemmer"   },
    { algo: "indonesian",  out: "indonesian",  cls: "IndonesianStemmer"  },
    { algo: "irish",       out: "irish",       cls: "IrishStemmer"       },
    { algo: "italian",     out: "italian",     cls: "ItalianStemmer"     },
    { algo: "lithuanian",  out: "lithuanian",  cls: "LithuanianStemmer"  },
    { algo: "nepali",      out: "nepali",      cls: "NepaliStemmer"      },
    { algo: "norwegian",   out: "norwegian",   cls: "NorwegianStemmer"   },
    { algo: "portuguese",  out: "portuguese",  cls: "PortugueseStemmer"  },
    { algo: "romanian",    out: "romanian",    cls: "RomanianStemmer"    },
    { algo: "russian",     out: "russian",     cls: "RussianStemmer"     },
    { algo: "serbian",     out: "serbian",     cls: "SerbianStemmer"     },
    { algo: "spanish",     out: "spanish",     cls: "SpanishStemmer"     },
    { algo: "swedish",     out: "swedish",     cls: "SwedishStemmer"     },
    { algo: "tamil",       out: "tamil",       cls: "TamilStemmer"       },
    { algo: "turkish",     out: "turkish",     cls: "TurkishStemmer"     },
]

const STEMMER_HEADER = (algo: string, cls: string) =>
    `// AUTO-GENERATED from snowballstem/snowball ${SNOWBALL_VERSION} algorithms/${algo}.sbl
// DO NOT EDIT — regenerate via \`bun run scripts/build-stemmers.ts\`
// Upstream license: BSD-3-Clause. See NOTICE for attribution.
// eslint-disable
// @ts-nocheck
import { BaseStemmer } from "./base-stemmer"
`

const STEMMER_FOOTER = (cls: string) =>
    `\nconst _stemmer = new ${cls}()
export const stem = (word: string): string => _stemmer.stemWord(word)
`

/** Strip CommonJS bits and the inline BaseStemmer require from a freshly
 *  generated Snowball JS file, leaving the class definition body intact. */
const cleanupGeneratedJs = (raw: string): string => {
    let out = raw
    // Drop the inline `var BaseStemmer = require('./base-stemmer.js');`
    // line — we import it as ESM at the top instead. Match flexibly: the
    // line may have leading whitespace and slightly different quoting.
    out = out.replace(
        /^\s*\/\*\* @const \*\/ var BaseStemmer = require\([^)]+\);\s*$/m,
        "",
    )
    // Drop the `if (typeof module === 'object' && module.exports) module.exports = X;`
    // tail — we attach our own ESM export below.
    out = out.replace(
        /^if \(typeof module === 'object' && module\.exports\) module\.exports = [\w$]+;\s*$/m,
        "",
    )
    return out.trimEnd() + "\n"
}

/** Convert base-stemmer.js (CJS) to base-stemmer.ts (ESM, no logic change). */
const buildBaseStemmer = (snowballRepo: string): void => {
    const src = readFileSync(
        join(snowballRepo, "javascript/base-stemmer.js"),
        "utf8",
    )
    // Strip the upstream `// @ts-check` directive — we use `@ts-nocheck`
    // in our generated header (the file is third-party code we don't
    // own; type errors there should stay quiet, not block our build).
    // Also drop the CJS export tail; everything else is fine as-is.
    const body = src
        .replace(/^\/\/ @ts-check\s*$/m, "")
        .replace(
            /^if \(typeof module === 'object' && module\.exports\) module\.exports = BaseStemmer;\s*$/m,
            "",
        )
        .trimStart()
        .trimEnd()
    const out = `// AUTO-GENERATED from snowballstem/snowball ${SNOWBALL_VERSION} javascript/base-stemmer.js
// DO NOT EDIT — regenerate via \`bun run scripts/build-stemmers.ts\`
// Upstream license: BSD-3-Clause. See NOTICE for attribution.
// eslint-disable
// @ts-nocheck
${body}
export { BaseStemmer }
`
    writeFileSync(join(STEMMERS_OUT, "base-stemmer.ts"), out)
}

const cloneSnowball = async (): Promise<string> => {
    if (existsSync(WORK_DIR)) rmSync(WORK_DIR, { recursive: true, force: true })
    mkdirSync(WORK_DIR, { recursive: true })
    const repoDir = join(WORK_DIR, "snowball")
    await $`git clone --depth 1 --branch ${SNOWBALL_VERSION} ${SNOWBALL_REPO} ${repoDir}`
        .quiet()
    return repoDir
}

const buildCompiler = async (repoDir: string): Promise<string> => {
    await $`make -C ${repoDir} snowball`.quiet()
    return join(repoDir, "snowball")
}

const buildStemmer = async (
    compiler: string,
    repoDir: string,
    { algo, out, cls }: (typeof LANGUAGES)[number],
): Promise<void> => {
    const sbl = join(repoDir, "algorithms", `${algo}.sbl`)
    const tmpOut = join(WORK_DIR, out)
    await $`${compiler} ${sbl} -js -o ${tmpOut} -n ${cls}`.quiet()
    const raw = readFileSync(`${tmpOut}.js`, "utf8")
    const cleaned = cleanupGeneratedJs(raw)
    const final = STEMMER_HEADER(algo, cls) + cleaned + STEMMER_FOOTER(cls)
    writeFileSync(join(STEMMERS_OUT, `${out}.ts`), final)
}

const main = async (): Promise<void> => {
    console.log(`Cloning snowballstem/snowball ${SNOWBALL_VERSION}...`)
    const repoDir = await cloneSnowball()
    console.log("Building snowball compiler (make)...")
    const compiler = await buildCompiler(repoDir)
    console.log(`Generating ${LANGUAGES.length} stemmers + base-stemmer...`)
    buildBaseStemmer(repoDir)
    for (const lang of LANGUAGES) {
        await buildStemmer(compiler, repoDir, lang)
        console.log(`  ✓ ${lang.algo}`)
    }
    console.log("Cleaning up...")
    rmSync(WORK_DIR, { recursive: true, force: true })
    console.log(`Done. ${LANGUAGES.length + 1} files written to src/stemmers/`)
}

void main()
