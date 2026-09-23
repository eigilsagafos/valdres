import { selector, type Selector } from "valdres"
import { keyboardAtom } from "../atoms/keyboardAtom"
import type { PressedKey } from "../types/PressedKey"

/**
 * Held keys in press order. A read-only selector since v1; the name keeps its
 * pre-v1 `Atom` suffix for compatibility.
 */
export const pressedKeysAtom: Selector<readonly PressedKey[]> = selector(
    get => get(keyboardAtom).pressed,
    { name: "@valdres/browser-keyboard/pressedKeys" },
)
