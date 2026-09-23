import { family, selector, type Selector } from "valdres"
import type { KeyboardCode } from "../types/KeyboardCode"
import { pressedKeysSelector } from "./pressedKeysSelector"

export const isCodePressedSelector: (code: KeyboardCode) => Selector<boolean> =
    family((code: KeyboardCode) =>
        selector(get => get(pressedKeysSelector).some(k => k.code === code), {
            name: `@valdres/browser-keyboard/isCodePressed/${code}`,
        }),
    )
