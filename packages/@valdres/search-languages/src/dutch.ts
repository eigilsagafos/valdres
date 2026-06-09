import { stem } from "./stemmers/dutch"
import { stopwords } from "./stopwords/dutch"
import { createPreset } from "./lib/createPreset"

const SPLITTER = /[^A-Za-zàèéìòóù0-9_'-]+/gim

export const dutch = createPreset(SPLITTER, stem, stopwords)
