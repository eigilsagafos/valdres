import { stem } from "./stemmers/norwegian"
import { stopwords } from "./stopwords/norwegian"
import { createPreset } from "./lib/createPreset"

const SPLITTER = /[^a-z0-9_æøåÆØÅäÄöÖüÜ]+/gim

export const norwegian = createPreset(SPLITTER, stem, stopwords)
