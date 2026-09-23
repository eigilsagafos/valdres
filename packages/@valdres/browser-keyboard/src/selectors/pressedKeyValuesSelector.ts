import { selector, type Selector } from "valdres"
import { pressedKeysSelector } from "./pressedKeysSelector"

export const pressedKeyValuesSelector: Selector<readonly string[]> = selector<
    readonly string[]
>(get => get(pressedKeysSelector).map(k => k.key.toLowerCase()), {
    name: "@valdres/browser-keyboard/pressedKeyValues",
})
