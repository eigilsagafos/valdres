import { stem } from "./stemmers/german"
import { stopwords } from "./stopwords/german"
import { createPreset } from "./lib/createPreset"

const SPLITTER = /[^a-z0-9A-ZäöüÄÖÜß]+/gim

export const german = createPreset(SPLITTER, stem, stopwords)
