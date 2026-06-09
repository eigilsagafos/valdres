/**
 * Default tokenizer for `atomFamilySearch`. Lowercases, splits on any
 * non-letter/non-digit (Unicode-aware), drops empty fragments.
 *
 * Examples:
 *   "Hello, world!"  -> ["hello", "world"]
 *   "café au lait"   -> ["café", "au", "lait"]
 *   ""               -> []
 *
 * Compose with `foldAccents` for accent-insensitive matching, or pass
 * a custom tokenizer to `atomFamilySearch` for stemming, n-grams,
 * locale-aware folding, stop-word filtering, etc.
 */
export const defaultTokenize = (text: string): string[] => {
    if (!text) return []
    return text
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter(t => t.length > 0)
}
