import { selector, type Selector } from "valdres"
import { pressedKeysAtom } from "./pressedKeysAtom"

export const pressedCodesSelector: Selector<string[]> = selector(
    get => get(pressedKeysAtom).map(k => k.code),
    { name: "@valdres/browser-keyboard/pressedCodes" },
)
