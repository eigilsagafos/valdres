import { selector } from "valdres"
import { colorSchemeAtom } from "../atoms/colorSchemeAtom"

export const isDarkSelector = selector(
    get => get(colorSchemeAtom) === "dark",
    { name: "@valdres/browser-color-scheme/isDark" },
)
