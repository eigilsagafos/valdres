import { externalAtom, type ExternalAtom } from "valdres"
import { keyboardSource } from "../lib/keyboardSource"
import type { KeyboardSnapshot } from "../types/KeyboardSnapshot"

export const keyboardAtom: ExternalAtom<KeyboardSnapshot> = externalAtom(
    keyboardSource,
    { name: "@valdres/browser-keyboard/keyboard" },
)
