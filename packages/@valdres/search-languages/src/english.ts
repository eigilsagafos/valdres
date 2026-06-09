import { stem } from "./stemmers/english"
import { stopwords } from "./stopwords/english"
import { createPreset } from "./lib/createPreset"

const SPLITTER = /[^A-Za-zàèéìòóù0-9_'-]+/gim

export const english = createPreset(SPLITTER, stem, stopwords)
