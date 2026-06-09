import { stem } from "./stemmers/serbian"
import { stopwords } from "./stopwords/serbian"
import { createPreset } from "./lib/createPreset"

const SPLITTER = /[^a-z0-9čćžšđČĆŽŠĐ]+/gim

export const serbian = createPreset(SPLITTER, stem, stopwords)
