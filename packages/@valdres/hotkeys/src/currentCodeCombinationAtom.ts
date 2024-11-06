import { atom } from "valdres"
import type { KeyboardCode } from "./types/KeyboardCode"

export const currentCodeCombinationAtom = atom<KeyboardCode[]>([], {
    global: true,
    label: "@valdres/hotkeys/currentCodeCombinationAtom",
})
