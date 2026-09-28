import { selector, type Selector } from "valdres"
import { keyboardAtom } from "./keyboardAtom"
import type { PressedKey } from "../types/PressedKey"

export const pressedKeysSelector: Selector<readonly PressedKey[]> = selector(
    get => get(keyboardAtom).pressed,
    { name: "@valdres/browser-keyboard/pressedKeys" },
)
