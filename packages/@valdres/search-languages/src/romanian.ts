import { stem } from "./stemmers/romanian"
import { stopwords } from "./stopwords/romanian"
import { createPreset } from "./lib/createPreset"

const SPLITTER = /[^a-z0-9ăâîșțĂÂÎȘȚ]+/gim

export const romanian = createPreset(SPLITTER, stem, stopwords)
