# @valdres/search-languages

Language presets — tokenizer + stemmer + stop-word list — for valdres'
`atomFamilySearch`. 25 languages, Snowball stemmers, no runtime
dependencies.

## Install

```sh
bun add @valdres/search-languages
# or: npm install @valdres/search-languages / pnpm add @valdres/search-languages
```

`valdres` is a peer dependency.

## Usage

Pass a preset as the `language` option. Per-language imports are
tree-shakable — you only pay for the languages you use.

```ts
import { atomFamily, atomFamilySearch } from "valdres"
import { french } from "@valdres/search-languages/french"

const post = atomFamily<{ body: string }, [string]>(null)
const search = atomFamilySearch(post, p => p.body, { language: french })
```

Or import from the barrel if you need several:

```ts
import { english, french, german } from "@valdres/search-languages"
```

A `LanguagePreset` is just a plain object:

```ts
type LanguagePreset = {
    tokenize: (text: string) => string[]
    stem: (word: string) => string
    stopWords: ReadonlySet<string>
}
```

You can hand-craft one (e.g. domain-specific stemmer for medical or
legal text) and pass it the same way — `language` accepts any
`LanguagePreset`, not just the bundled ones.

## Languages

25 languages ship with stemmer + tokenizer + stop words:

| Stemmer (Snowball) | Stop words |
|---|---|
| arabic, armenian, danish, dutch, english, finnish, french, german, greek, hindi, hungarian, indonesian, irish, italian, lithuanian, nepali, norwegian, portuguese, romanian, russian, serbian, spanish, swedish, tamil, turkish | Snowball stopwords for 15 (danish, dutch, english, finnish, french, german, hungarian, indonesian, irish, italian, norwegian, portuguese, russian, spanish, swedish); stopwords-iso for 7 (arabic, armenian, greek, hindi, lithuanian, romanian, turkish); empty for 3 (nepali, serbian, tamil — no defensible upstream source) |

### Coverage gaps

- **`nepali`, `serbian`, `tamil`** ship an empty stop-word list. Neither
  Snowball nor stopwords-iso has data for these; we didn't find a
  defensible upstream we could vendor. The stemmer + tokenizer still
  work. Override with `{ stopWords: yourCustomSet }` if you have a list.
- **Arabic has no `voc.txt`/`output.txt`** in `snowball-data`, so we
  don't run a stemmer-parity regression test for it. The stemmer
  itself is canonical Snowball output.

### Overriding per instance

The `language` option only sets defaults. Anything you pass alongside
wins:

```ts
atomFamilySearch(post, p => p.body, {
    language: english,
    stopWords: new Set([...english.stopWords, "lorem", "ipsum"]),
})
```

## Architecture

Three categories of vendored content, each regenerable from a pinned
upstream source:

| Content | Source | Pinned at | Regenerate |
|---|---|---|---|
| Stemmer JS | `snowballstem/snowball` | `v3.0.1` | `bun run build:stemmers` |
| Stop words | Snowball + `stopwords-iso` | `v3.0.1` + `v0.4.0` | `bun run build:stopwords` |
| Test fixtures | `snowballstem/snowball-data` | commit `381b4475` | `bun run build:fixtures` |

Generated files (`src/stemmers/*.ts`, `src/stopwords/*.ts`,
`test/fixtures/*.ts`) are committed to source — end users never run the
generation scripts. Maintainers re-run them when refreshing upstream
versions. See `NOTICE` for license attribution.

Splitter regexes are language-specific (one per file, e.g.
`src/french.ts`). They encode word-boundary rules — kept characters per
script, hyphens-in-words for Latin scripts, full Unicode blocks for
non-Latin scripts. Derived from Orama's per-language splitter table
(Apache-2.0, attributed in `NOTICE`).

## Adding a language

1. Confirm Snowball ships an algorithm (`algorithms/<lang>.sbl` in
   `snowballstem/snowball`). If not, you'll need a custom stemmer
   (out of scope for this package — submit it as a `LanguagePreset` in
   your own code).
2. Add `{ algo, out, cls }` to `LANGUAGES` in
   `scripts/build-stemmers.ts`. Run `bun run build:stemmers`.
3. Add `{ name, source }` to `LANGUAGES` in
   `scripts/fetch-stopwords.ts`. Prefer Snowball if available; fall
   back to stopwords-iso. Run `bun run build:stopwords`.
4. Add the language name to `LANGUAGES` in
   `scripts/fetch-test-vectors.ts`. Run `bun run build:fixtures`.
5. Write `src/<lang>.ts` (6 lines — copy the pattern from any
   existing one). Define a splitter regex appropriate to the script.
6. Add the export to `src/index.ts` and the subpath export to
   `package.json#exports`.
7. Add fixture import + suite entry to `src/snowballParity.test.ts`.
8. For non-Latin scripts, add a script-preservation case to the
   `script-preserving tokenizers` describe block in
   `src/searchLanguages.test.ts`.

## Tests

```sh
bun test
```

Two test files:

- **`searchLanguages.test.ts`** — preset-shape smoke tests, end-to-end
  stemming via `atomFamilySearch` for english/french/norwegian,
  script-preservation assertions for non-Latin tokenizers.
- **`snowballParity.test.ts`** — for each language with upstream test
  data, asserts that our generated stemmer matches Snowball's reference
  `output.txt` byte-for-byte on a sample of 100 (input, expected) pairs.
  Catches build-pipeline regressions and unintended drift across
  Snowball version bumps.

## License

MIT. Vendors generated content from upstream sources — see `NOTICE` for
full attribution (`Snowball` BSD-3-Clause; `stopwords-iso` MIT; Orama
splitter regexes Apache-2.0).
