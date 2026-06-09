import { stem } from "./stemmers/indonesian"
import { stopwords } from "./stopwords/indonesian"
import { createPreset } from "./lib/createPreset"

const SPLITTER = /[^a-z0-9]+/gim

export const indonesian = createPreset(SPLITTER, stem, stopwords)
