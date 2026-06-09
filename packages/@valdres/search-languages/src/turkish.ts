import { stem } from "./stemmers/turkish"
import { stopwords } from "./stopwords/turkish"
import { createPreset } from "./lib/createPreset"

const SPLITTER = /[^a-z0-9çÇğĞıİöÖşŞüÜ]+/gim

export const turkish = createPreset(SPLITTER, stem, stopwords)
