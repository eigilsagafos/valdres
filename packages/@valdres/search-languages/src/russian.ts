import { stem } from "./stemmers/russian"
import { stopwords } from "./stopwords/russian"
import { createPreset } from "./lib/createPreset"

const SPLITTER = /[^a-z0-9а-яА-ЯёЁ]+/gim

export const russian = createPreset(SPLITTER, stem, stopwords)
