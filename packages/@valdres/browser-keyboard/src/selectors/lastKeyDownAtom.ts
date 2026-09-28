import { selector, type Selector } from "valdres"
import { keyboardSourceAtom } from "../atoms/keyboardSourceAtom"
import type { KeyDown } from "../types/KeyDown"

/**
 * The most recent keydown, repeats included; `null` before the first and after
 * a focus-loss reset. A read-only selector over the same source as
 * `keyboardAtom`, so both change in the same settlement.
 */
export const lastKeyDownAtom: Selector<KeyDown | null> = selector(
    get => get(keyboardSourceAtom).lastKeyDown,
    { name: "@valdres/browser-keyboard/lastKeyDown" },
)
