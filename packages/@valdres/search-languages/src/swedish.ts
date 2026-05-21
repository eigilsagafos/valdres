import { stem } from "./stemmers/swedish"
import { stopwords } from "./stopwords/swedish"
import { createPreset } from "./lib/createPreset"

const SPLITTER = /[^a-z0-9_åÅäÄöÖüÜ-]+/gim

export const swedish = createPreset(SPLITTER, stem, stopwords)
