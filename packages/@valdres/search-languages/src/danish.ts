import { stem } from "./stemmers/danish"
import { stopwords } from "./stopwords/danish"
import { createPreset } from "./lib/createPreset"

const SPLITTER = /[^a-z0-9æøåÆØÅ]+/gim

export const danish = createPreset(SPLITTER, stem, stopwords)
