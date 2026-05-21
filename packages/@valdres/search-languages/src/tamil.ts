import { stem } from "./stemmers/tamil"
import { stopwords } from "./stopwords/tamil"
import { createPreset } from "./lib/createPreset"

// Full Tamil block U+0B80–U+0BFF. The previous range `அ-ஹ` only
// covered base consonants/vowels and dropped vowel signs and the
// pulli (்), splitting tokens like `வணக்கம்` into `வணக`+`கம`.
const SPLITTER = /[^a-z0-9஀-௿]+/gim

export const tamil = createPreset(SPLITTER, stem, stopwords)
