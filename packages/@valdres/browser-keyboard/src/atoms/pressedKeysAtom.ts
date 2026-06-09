import { atom } from "valdres"
import type { PressedKey } from "../types/PressedKey"
import { bootstrap } from "../lib/bootstrap"

export const pressedKeysAtom = atom<PressedKey[]>([], {
    global: true,
    name: "@valdres/browser-keyboard/pressedKeys",
    onMount: () => bootstrap(),
})
