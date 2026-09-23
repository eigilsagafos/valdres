import { selector, type Selector } from "valdres"
import { pressedKeysAtom } from "./pressedKeysAtom"

export const pressedKeyValuesSelector: Selector<string[]> = selector(
    get => get(pressedKeysAtom).map(k => k.key.toLowerCase()),
    { name: "@valdres/browser-keyboard/pressedKeyValues" },
)
