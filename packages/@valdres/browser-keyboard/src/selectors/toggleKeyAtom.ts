import { family, selector, type Selector } from "valdres"
import { keyboardAtom } from "../atoms/keyboardAtom"
import type { ToggleKey } from "../types/ToggleKey"

/**
 * A lock's state as of the last observed key event: `null` until then. A
 * read-only selector family since v1; the name keeps its pre-v1 `Atom` suffix
 * for compatibility.
 */
export const toggleKeyAtom: (key: ToggleKey) => Selector<boolean | null> = family(
    (key: ToggleKey) =>
        selector(get => get(keyboardAtom).locks[key], {
            name: `@valdres/browser-keyboard/toggleKey/${key}`,
        }),
)
