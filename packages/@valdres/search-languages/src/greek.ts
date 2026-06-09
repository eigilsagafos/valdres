import { stem } from "./stemmers/greek"
import { stopwords } from "./stopwords/greek"
import { createPreset } from "./lib/createPreset"

const SPLITTER = /[^a-z0-9α-ωά-ώ]+/gim

export const greek = createPreset(SPLITTER, stem, stopwords)
