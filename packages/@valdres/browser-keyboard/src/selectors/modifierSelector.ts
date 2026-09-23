import { family, selector, type Selector } from "valdres"
import { pressedKeysSelector } from "./pressedKeysSelector"

export type Modifier = "shift" | "ctrl" | "alt" | "meta"

const modifierCodes: Record<Modifier, [string, string]> = {
    shift: ["ShiftLeft", "ShiftRight"],
    ctrl: ["ControlLeft", "ControlRight"],
    alt: ["AltLeft", "AltRight"],
    meta: ["MetaLeft", "MetaRight"],
}

/**
 * Whether either side of the modifier has been observed going down and not
 * yet up. Event modifier flags are not used: a modifier held before activation
 * or a focus-loss reset is not reported until its own keydown is observed.
 */
export const modifierSelector: (modifier: Modifier) => Selector<boolean> = family(
    (modifier: Modifier) =>
        selector(
            get => {
                const [left, right] = modifierCodes[modifier]
                return get(pressedKeysSelector).some(k => k.code === left || k.code === right)
            },
            { name: `@valdres/browser-keyboard/modifier/${modifier}` },
        ),
)
