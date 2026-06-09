import { englishStopWords } from "./englishStopWords"

/** A half-open `[start, end)` character range in the source text. */
export type HighlightRange = { start: number; end: number }

export type HighlightOptions = {
    /** `"exact"` (default): a text word is highlighted when its normalized
     *  form equals a normalized query word. `"prefix"`: highlighted when it
     *  starts with a query word — mirror of `atomFamilySearch`'s prefix
     *  mode, for autocomplete-style highlighting. */
    mode?: "exact" | "prefix"
    /** Stemmer applied to both text and query words before comparing — pass
     *  the SAME one given to `atomFamilySearch` (e.g. a language preset's
     *  `stem`) so highlights line up with hits. */
    stem?: (word: string) => string
    /** Words dropped from the query (and never highlighted). `true` uses the
     *  English defaults; pass the preset's `stopWords` to match a configured
     *  search. */
    stopWords?: ReadonlySet<string> | true
    /** Merge consecutive matched words separated only by non-word
     *  characters into one range (default `false` — each matched word is its
     *  own range). Useful for highlighting an adjacent matched run as a
     *  single span, separators included. */
    merge?: boolean
}

// Word-character runs — the complement of defaultTokenize's split pattern,
// so token boundaries line up with how the search tokenized the text.
const WORD_RE = /[\p{L}\p{N}]+/gu

const resolveStop = (
    opt: ReadonlySet<string> | true | undefined,
): ReadonlySet<string> | null => {
    if (opt === undefined) return null
    if (opt === true) return englishStopWords
    return opt
}

/**
 * Compute the character ranges in `text` that match `query`, for UI
 * highlighting of search results.
 *
 * Self-contained: it operates on raw text the caller already has (the
 * search index stores terms, not source text), re-tokenizing with the same
 * word-boundary rules as `defaultTokenize` but tracking character offsets.
 * Pass the same `stem` / `stopWords` / `mode` you gave `atomFamilySearch`
 * so the highlighted words match the ones that produced the hit.
 *
 *   highlightMatches("The Eternal Stranger", "stranger")
 *   // [{ start: 12, end: 20 }]
 *
 * Word-level: every occurrence of a matching word is returned. Phrase-aware
 * highlighting (only the adjacent run) can be layered on top using the
 * ranges' order. Custom non-word tokenizers aren't supported — offsets
 * follow the default Unicode word-split.
 */
export const highlightMatches = (
    text: string,
    query: string,
    options?: HighlightOptions,
): HighlightRange[] => {
    const mode = options?.mode ?? "exact"
    const stem = options?.stem
    const stopWords = resolveStop(options?.stopWords)

    const norm = (raw: string): string | null => {
        const lower = raw.toLowerCase()
        if (stopWords?.has(lower)) return null
        const s = stem ? stem(lower) : lower
        return s.length > 0 ? s : null
    }

    const queryTerms = new Set<string>()
    for (const m of query.matchAll(WORD_RE)) {
        const n = norm(m[0])
        if (n) queryTerms.add(n)
    }
    if (queryTerms.size === 0) return []

    const ranges: HighlightRange[] = []
    for (const m of text.matchAll(WORD_RE)) {
        const n = norm(m[0])
        if (!n) continue
        let hit: boolean
        if (mode === "prefix") {
            hit = false
            for (const q of queryTerms) {
                if (n.startsWith(q)) {
                    hit = true
                    break
                }
            }
        } else {
            hit = queryTerms.has(n)
        }
        if (hit) {
            const start = m.index as number
            ranges.push({ start, end: start + m[0].length })
        }
    }

    if (!options?.merge || ranges.length < 2) return ranges
    const merged: HighlightRange[] = [{ ...ranges[0] }]
    for (let i = 1; i < ranges.length; i++) {
        const last = merged[merged.length - 1]
        // Merge when the gap between the previous range and this one is
        // empty or only non-word characters (separators) — i.e. the matched
        // words are adjacent in the text. (A fresh non-global test — WORD_RE
        // is stateful from the `g` flag and is mid-iteration elsewhere.)
        const between = text.slice(last.end, ranges[i].start)
        if (ranges[i].start <= last.end || !/[\p{L}\p{N}]/u.test(between)) {
            if (ranges[i].end > last.end) last.end = ranges[i].end
        } else {
            merged.push({ ...ranges[i] })
        }
    }
    return merged
}
