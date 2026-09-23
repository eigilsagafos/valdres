import { family, selector, type Selector } from "valdres"
import { keyboardAtom } from "../atoms/keyboardAtom"
import type { ToggleKey } from "../types/ToggleKey"

/** A lock's state as of the last observed key event: `null` until then. */
export const toggleKeySelector: (key: ToggleKey) => Selector<boolean | null> = family(
    (key: ToggleKey) =>
        selector(get => get(keyboardAtom).locks[key], {
            name: `@valdres/browser-keyboard/toggleKey/${key}`,
        }),
)
