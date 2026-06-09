/**
 * Split a token into 3-character n-grams, padded on both sides with
 * boundary markers so that edge n-grams (those covering the start/end
 * of the word) are distinct from middle ones. Used by `atomFamilySearch`
 * in `trigram` mode for fuzzy / typo-tolerant matching.
 *
 *   trigramsOf("hello")
 *     → ["\x00\x00h", "\x00he", "hel", "ell", "llo", "lo\x00", "o\x00\x00"]
 *
 *   trigramsOf("he")
 *     → ["\x00\x00h", "\x00he", "he\x00", "e\x00\x00"]
 *
 *   trigramsOf("") → []
 *
 * Why boundary markers: a query like `"hel"` produces trigrams
 * `["\x00\x00h", "\x00he", "hel", "el\x00", "l\x00\x00"]`. Documents that
 * START with `"hel..."` share `"\x00\x00h"` and `"\x00he"` with the query,
 * which pushes them above documents that only contain `"hel"` mid-word.
 * That makes prefix-style matches rank above middle-of-word matches
 * automatically, without a separate prefix index.
 */
const BOUNDARY = "\x00"

export const trigramsOf = (token: string): string[] => {
    if (token.length === 0) return []
    const padded = `${BOUNDARY}${BOUNDARY}${token}${BOUNDARY}${BOUNDARY}`
    const count = padded.length - 2
    const out = new Array<string>(count)
    for (let i = 0; i < count; i++) {
        out[i] = padded.slice(i, i + 3)
    }
    return out
}
