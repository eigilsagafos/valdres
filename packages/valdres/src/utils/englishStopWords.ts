/**
 * Default English stop word list — words that occur so frequently they
 * carry little signal in a search index. Filtering them out before
 * indexing reduces the index size and improves ranking quality (rare
 * terms dominate the score instead of being washed out by "the", "of",
 * etc.).
 *
 * Pass `{ stopWords: englishStopWords }` to `atomFamilySearch`, or
 * compose your own Set for other languages / domains:
 *
 *   const myStopWords = new Set([...englishStopWords, "lorem", "ipsum"])
 */
export const englishStopWords: ReadonlySet<string> = new Set([
    "a", "an", "and", "are", "as", "at", "be", "been", "but", "by",
    "do", "does", "for", "from", "had", "has", "have", "he", "her", "him",
    "his", "how", "i", "if", "in", "into", "is", "it", "its", "no",
    "not", "of", "on", "or", "our", "out", "she", "so", "some", "than",
    "that", "the", "their", "them", "then", "there", "these", "they",
    "this", "those", "to", "up", "was", "we", "were", "what", "when",
    "where", "which", "who", "why", "will", "with", "would", "you",
    "your",
])
