import { atom } from "valdres"
import type { PressedKey } from "../../types/PressedKey"

export const pressedKeysAtom = atom<PressedKey[]>([], {
    global: true,
    name: "@valdres/browser-keyboard/pressedKeys",
})
