import { selectorFamily } from "valdres"
import { pressedKeysAtom } from "../atoms/pressedKeysAtom"

export type Modifier = "shift" | "ctrl" | "alt" | "meta"

const modifierCodes: Record<Modifier, [string, string]> = {
    shift: ["ShiftLeft", "ShiftRight"],
    ctrl: ["ControlLeft", "ControlRight"],
    alt: ["AltLeft", "AltRight"],
    meta: ["MetaLeft", "MetaRight"],
}

export const modifierSelector = selectorFamily<boolean, [Modifier]>(
    (modifier: Modifier) => get => {
        const keys = get(pressedKeysAtom)
        const [left, right] = modifierCodes[modifier]
        return keys.some(k => k.code === left || k.code === right)
    },
    { name: "@valdres/browser-keyboard/modifier" },
)
