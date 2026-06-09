import { stem } from "./stemmers/armenian"
import { stopwords } from "./stopwords/armenian"
import { createPreset } from "./lib/createPreset"

const SPLITTER = /[^a-z0-9ա-ֆ]+/gim

export const armenian = createPreset(SPLITTER, stem, stopwords)
