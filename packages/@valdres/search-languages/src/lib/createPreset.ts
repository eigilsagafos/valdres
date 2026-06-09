import type { LanguagePreset } from "valdres"

/**
 * Build a `LanguagePreset` from the three pieces. Centralizes the
 * tokenize wrapper (`lowercase` + `regex split` + `drop empty`) so
 * every per-language module is a one-liner.
 *
 * Each language's splitter regex lives at the top of its preset file
 * (e.g. `src/french.ts`). The regex encodes language-specific word-
 * boundary rules — kept characters per script, hyphens-in-words for
 * Latin scripts, etc. — that a generic Unicode splitter doesn't get
 * right. See `NOTICE` for attribution.
 */
export const createPreset = (
    splitter: RegExp,
    stem: (word: string) => string,
    stopwordList: readonly string[],
): LanguagePreset => ({
    tokenize: text =>
        text.toLowerCase().split(splitter).filter(t => t.length > 0),
    stem,
    stopWords: new Set(stopwordList),
})
