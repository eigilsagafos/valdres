import { selector } from "valdres"
import { pressedKeysAtom } from "../atoms/pressedKeysAtom"

export const pressedCodesSelector = selector(
    get => get(pressedKeysAtom).map(k => k.code),
    { name: "@valdres/browser-keyboard/pressedCodes" },
)
