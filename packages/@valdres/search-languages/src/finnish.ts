import { stem } from "./stemmers/finnish"
import { stopwords } from "./stopwords/finnish"
import { createPreset } from "./lib/createPreset"

const SPLITTER = /[^a-z0-9äöÄÖ]+/gim

export const finnish = createPreset(SPLITTER, stem, stopwords)
