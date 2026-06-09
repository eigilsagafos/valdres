import { stem } from "./stemmers/nepali"
import { stopwords } from "./stopwords/nepali"
import { createPreset } from "./lib/createPreset"

// Full Devanagari block U+0900–U+097F. See `hindi.ts` — same block,
// same reasoning (combining marks must survive tokenization).
const SPLITTER = /[^a-z0-9ऀ-ॿ]+/gim

export const nepali = createPreset(SPLITTER, stem, stopwords)
