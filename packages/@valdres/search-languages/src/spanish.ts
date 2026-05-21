import { stem } from "./stemmers/spanish"
import { stopwords } from "./stopwords/spanish"
import { createPreset } from "./lib/createPreset"

const SPLITTER = /[^a-z0-9A-Zá-úÁ-ÚñÑüÜ]+/gim

export const spanish = createPreset(SPLITTER, stem, stopwords)
