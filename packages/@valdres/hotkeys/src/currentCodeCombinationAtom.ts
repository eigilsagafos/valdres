import { globalAtom } from "valdres"
import type { KeyboardCode } from "./types/KeyboardCode"

export const currentCodeCombinationAtom = globalAtom<KeyboardCode[]>([], {
    name: "@valdres/hotkeys/currentCodeCombinationAtom",
})
