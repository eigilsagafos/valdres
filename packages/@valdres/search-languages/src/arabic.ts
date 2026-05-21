import { stem } from "./stemmers/arabic"
import { stopwords } from "./stopwords/arabic"
import { createPreset } from "./lib/createPreset"

const SPLITTER = /[^a-z0-9أ-ي]+/gim

export const arabic = createPreset(SPLITTER, stem, stopwords)
