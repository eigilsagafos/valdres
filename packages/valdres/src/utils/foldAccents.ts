/**
 * Strip combining diacritical marks from a string via NFD normalization,
 * making text matching insensitive to accents.
 *
 *   foldAccents("café")  → "cafe"
 *   foldAccents("naïve") → "naive"
 *
 * Use inside a custom `tokenize` for `atomFamilySearch` when you want
 * "café" to match a query for "cafe":
 *
 *   import { atomFamilySearch, defaultTokenize, foldAccents } from "valdres"
 *
 *   atomFamilySearch(posts, p => p.title, {
 *       mode: "trigram",
 *       tokenize: text => defaultTokenize(foldAccents(text)),
 *   })
 */
export const foldAccents = (text: string): string =>
    text.normalize("NFD").replace(/[̀-ͯ]/g, "")
