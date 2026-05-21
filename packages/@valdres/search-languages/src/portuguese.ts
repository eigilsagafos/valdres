import { stem } from "./stemmers/portuguese"
import { stopwords } from "./stopwords/portuguese"
import { createPreset } from "./lib/createPreset"

const SPLITTER = /[^a-z0-9à-úÀ-Ú]/gim

export const portuguese = createPreset(SPLITTER, stem, stopwords)
