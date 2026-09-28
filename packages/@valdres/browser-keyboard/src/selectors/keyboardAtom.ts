import { selector, type Selector } from "valdres"
import { keyboardSourceAtom } from "../atoms/keyboardSourceAtom"
import type { KeyboardSnapshot } from "../types/KeyboardSnapshot"

/**
 * Held keys and locks. A read-only selector over the package's single source;
 * the name keeps its `Atom` suffix. Keeps its identity across events that do
 * not change held keys or locks, such as repeats.
 */
export const keyboardAtom: Selector<KeyboardSnapshot> = selector(
    get => get(keyboardSourceAtom).keyboard,
    { name: "@valdres/browser-keyboard/keyboard" },
)
