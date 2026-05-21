import { stem } from "./stemmers/hungarian"
import { stopwords } from "./stopwords/hungarian"
import { createPreset } from "./lib/createPreset"

const SPLITTER = /[^a-z0-9áéíóöőúüűÁÉÍÓÖŐÚÜŰ]+/gim

export const hungarian = createPreset(SPLITTER, stem, stopwords)
