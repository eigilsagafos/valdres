import { stem } from "./stemmers/french"
import { stopwords } from "./stopwords/french"
import { createPreset } from "./lib/createPreset"

const SPLITTER = /[^a-z0-9äâàéèëêïîöôùüûœç-]+/gim

export const french = createPreset(SPLITTER, stem, stopwords)
