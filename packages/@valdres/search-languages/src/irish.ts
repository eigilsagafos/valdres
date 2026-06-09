import { stem } from "./stemmers/irish"
import { stopwords } from "./stopwords/irish"
import { createPreset } from "./lib/createPreset"

const SPLITTER = /[^a-z0-9áéíóúÁÉÍÓÚ]+/gim

export const irish = createPreset(SPLITTER, stem, stopwords)
