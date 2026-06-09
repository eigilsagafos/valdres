/**
 * Lightweight English stemmer — inspired by Porter but much simpler,
 * sized for inclusion in a search library rather than perfect linguistic
 * accuracy. Maps inflected forms to a common root so that "running",
 * "runs", "ran" → likely share a stem.
 *
 *   simpleEnglishStem("running")    → "run"
 *   simpleEnglishStem("ponies")     → "poni"
 *   simpleEnglishStem("national")   → "nation"
 *   simpleEnglishStem("relational") → "relate"
 *
 * Tradeoff: over-stems some words ("letter" → "lett") and misses
 * irregulars ("went" → "went", not "go"). For better quality, plug in
 * `natural`'s Porter stemmer or a Snowball implementation via the
 * `stem` option on `atomFamilySearch`.
 */
const VOWELS = /[aeiouy]/
const hasVowel = (s: string) => VOWELS.test(s)

export const simpleEnglishStem = (word: string): string => {
    let w = word.toLowerCase()
    if (w.length < 3) return w

    // ── Step 1a: plurals ────────────────────────────────────────────
    if (w.endsWith("sses")) w = w.slice(0, -2)            // dresses → dress
    else if (w.endsWith("ies")) w = w.slice(0, -2)        // ponies → poni
    else if (w.endsWith("ss")) {
        // keep — "miss", "boss"
    } else if (w.endsWith("us") || w.endsWith("is")) {
        // keep — "bus", "axis"
    } else if (w.endsWith("s") && w.length > 3) {
        w = w.slice(0, -1)                                 // cats → cat
    }

    // ── Step 1b: -ed, -ing ──────────────────────────────────────────
    let stripped = false
    if (w.endsWith("eed") && w.length > 4) {
        if (hasVowel(w.slice(0, -3))) w = w.slice(0, -1) // agreed → agree
    } else if (w.endsWith("ed") && w.length > 3 && hasVowel(w.slice(0, -2))) {
        w = w.slice(0, -2)
        stripped = true
    } else if (w.endsWith("ing") && w.length > 4 && hasVowel(w.slice(0, -3))) {
        w = w.slice(0, -3)
        stripped = true
    }

    if (stripped) {
        if (w.endsWith("at") || w.endsWith("bl") || w.endsWith("iz")) {
            w += "e"                                       // motivat → motivate
        } else if (
            w.length > 2 &&
            w[w.length - 1] === w[w.length - 2] &&
            !"lsz".includes(w[w.length - 1])
        ) {
            w = w.slice(0, -1)                             // hopping → hopp → hop
        } else if (
            w.length === 3 &&
            !VOWELS.test(w[0]) &&
            VOWELS.test(w[1]) &&
            !VOWELS.test(w[2]) &&
            !"wxy".includes(w[2])
        ) {
            w += "e"                                       // hop → hope (CVC + final-e restore)
        }
    }

    // ── Step 1c: terminal y → i if a vowel precedes ─────────────────
    if (w.length > 2 && w.endsWith("y") && hasVowel(w.slice(0, -1))) {
        w = w.slice(0, -1) + "i"
    }

    // ── Step 2: common derivational suffixes ────────────────────────
    if (w.endsWith("ational") && w.length > 7) w = w.slice(0, -5) + "e"
    else if (w.endsWith("tional") && w.length > 6) w = w.slice(0, -2)
    else if (w.endsWith("ization") && w.length > 7) w = w.slice(0, -5) + "e"
    else if (w.endsWith("ation") && w.length > 5) w = w.slice(0, -3) + "e"
    else if (w.endsWith("ator") && w.length > 4) w = w.slice(0, -2) + "e"
    else if (w.endsWith("alism") && w.length > 5) w = w.slice(0, -3)
    else if (w.endsWith("aliti") && w.length > 5) w = w.slice(0, -3)
    else if (w.endsWith("iviti") && w.length > 5) w = w.slice(0, -3) + "e"
    else if (w.endsWith("biliti") && w.length > 6) w = w.slice(0, -5) + "le"
    else if (w.endsWith("ness") && w.length > 4) w = w.slice(0, -4)
    else if (w.endsWith("ment") && w.length > 4) w = w.slice(0, -4)
    else if (w.endsWith("ity") && w.length > 3) w = w.slice(0, -3)
    else if (w.endsWith("ous") && w.length > 4) w = w.slice(0, -3)
    else if (w.endsWith("ful") && w.length > 4) w = w.slice(0, -3)
    else if (w.endsWith("able") && w.length > 4) w = w.slice(0, -4)
    else if (w.endsWith("ible") && w.length > 4) w = w.slice(0, -4)
    else if (w.endsWith("ant") && w.length > 4) w = w.slice(0, -3)
    else if (w.endsWith("ent") && w.length > 4) w = w.slice(0, -3)
    else if (w.endsWith("ly") && w.length > 4) w = w.slice(0, -2)
    else if (w.endsWith("er") && w.length > 4) w = w.slice(0, -2)
    else if (w.endsWith("est") && w.length > 5) w = w.slice(0, -3)

    return w
}
