import { family, selector, type Selector } from "valdres"
import { lastKeyDownAtom } from "../atoms/lastKeyDownAtom"
import type { KeyboardCode } from "../types/KeyboardCode"
import type { KeyDown } from "../types/KeyDown"

/**
 * The most recent keydown when it was `code`, repeats included; `null` once a
 * different key goes down, and after a focus-loss reset.
 */
export const lastKeyDownSelector: (
    code: KeyboardCode,
) => Selector<KeyDown | null> = family((code: KeyboardCode) =>
    selector(
        get => {
            const keyDown = get(lastKeyDownAtom)
            return keyDown?.code === code ? keyDown : null
        },
        { name: `@valdres/browser-keyboard/lastKeyDown/${code}` },
    ),
)
