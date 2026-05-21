import { stem } from "./stemmers/hindi"
import { stopwords } from "./stopwords/hindi"
import { createPreset } from "./lib/createPreset"

// Full Devanagari block U+0900–U+097F. Covers base letters, vowel
// signs (मा, की), virama (्), candrabindu, danda, and numerals — all
// required to keep multi-codepoint Hindi tokens intact.
const SPLITTER = /[^a-z0-9ऀ-ॿ]+/gim

export const hindi = createPreset(SPLITTER, stem, stopwords)
