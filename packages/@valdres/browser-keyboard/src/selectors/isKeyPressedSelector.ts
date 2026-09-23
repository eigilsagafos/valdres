import { family, selector, type Selector } from "valdres"
import { pressedKeysSelector } from "./pressedKeysSelector"

export const isKeyPressedSelector: (key: string) => Selector<boolean> = family(
    (key: string) => {
        const lower = key.toLowerCase()
        return selector(
            get => get(pressedKeysSelector).some(k => k.key.toLowerCase() === lower),
            { name: `@valdres/browser-keyboard/isKeyPressed/${key}` },
        )
    },
)
