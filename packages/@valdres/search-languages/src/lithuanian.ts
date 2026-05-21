import { stem } from "./stemmers/lithuanian"
import { stopwords } from "./stopwords/lithuanian"
import { createPreset } from "./lib/createPreset"

const SPLITTER = /[^a-z0-9ąčęėįšųūžĄČĘĖĮŠŲŪŽ]+/gim

export const lithuanian = createPreset(SPLITTER, stem, stopwords)
