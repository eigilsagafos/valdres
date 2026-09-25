import { externalAtom, type ExternalAtom } from "valdres"
import { lastKeyDownSource } from "../lib/lastKeyDownSource"
import type { KeyDown } from "../types/KeyDown"

export const lastKeyDownAtom: ExternalAtom<KeyDown | null> = externalAtom(
    lastKeyDownSource,
    { name: "@valdres/browser-keyboard/lastKeyDown" },
)
