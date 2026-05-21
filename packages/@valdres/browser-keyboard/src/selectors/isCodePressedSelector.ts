import { selectorFamily } from "valdres"
import { pressedKeysAtom } from "../atoms/pressedKeysAtom"
import type { KeyboardCode } from "../types/KeyboardCode"

export const isCodePressedSelector = selectorFamily<boolean, [KeyboardCode]>(
    (code: KeyboardCode) => get => {
        return get(pressedKeysAtom).some(k => k.code === code)
    },
    { name: "@valdres/browser-keyboard/isCodePressed" },
)
