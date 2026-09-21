import { externalAtom, type ExternalAtom } from "valdres"
import { colorSchemeSource } from "../lib/colorSchemeSource"
import type { ColorScheme } from "../types/ColorScheme"

export const colorSchemeAtom: ExternalAtom<ColorScheme> = externalAtom(
    colorSchemeSource,
    { name: "@valdres/browser-color-scheme/colorScheme" },
)
