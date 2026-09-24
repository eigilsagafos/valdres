import { selector, type Selector } from "valdres"
import { keyboardAtom } from "../atoms/keyboardAtom"
import type { PressedKey } from "../types/PressedKey"

export const pressedKeysSelector: Selector<readonly PressedKey[]> = selector(
    get => get(keyboardAtom).pressed,
    { name: "@valdres/browser-keyboard/pressedKeys" },
)
