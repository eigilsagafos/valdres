import { stem } from "./stemmers/italian"
import { stopwords } from "./stopwords/italian"
import { createPreset } from "./lib/createPreset"

const SPLITTER = /[^A-Za-zàèéìòóù0-9_'-]+/gim

export const italian = createPreset(SPLITTER, stem, stopwords)
