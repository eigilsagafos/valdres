import { selector, type Selector } from "valdres"
import { pressedKeysSelector } from "./pressedKeysSelector"

export const pressedCodesSelector: Selector<readonly string[]> = selector<
    readonly string[]
>(get => Object.freeze(get(pressedKeysSelector).map(k => k.code)), {
    name: "@valdres/browser-keyboard/pressedCodes",
})
