import { globalAtom } from "valdres"
import type { PressedKey } from "../types/PressedKey"
import { bootstrap } from "../lib/bootstrap"

export const pressedKeysAtom = globalAtom<PressedKey[]>([], {
    name: "@valdres/browser-keyboard/pressedKeys",
    onMount: () => bootstrap(),
})
