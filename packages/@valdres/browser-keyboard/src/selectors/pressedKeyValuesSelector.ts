import { selector } from "valdres"
import { pressedKeysAtom } from "../atoms/pressedKeysAtom"

export const pressedKeyValuesSelector = selector(
    get => get(pressedKeysAtom).map(k => k.key.toLowerCase()),
    { name: "@valdres/browser-keyboard/pressedKeyValues" },
)
