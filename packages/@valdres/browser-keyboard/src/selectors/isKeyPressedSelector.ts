import { selectorFamily } from "valdres"
import { pressedKeysAtom } from "../atoms/pressedKeysAtom"

export const isKeyPressedSelector = selectorFamily<boolean, [string]>(
    (key: string) => get => {
        const lower = key.toLowerCase()
        return get(pressedKeysAtom).some(k => k.key.toLowerCase() === lower)
    },
    { name: "@valdres/browser-keyboard/isKeyPressed" },
)
