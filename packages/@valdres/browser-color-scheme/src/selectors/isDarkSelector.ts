import { selector, type Selector } from "valdres"
import { colorSchemeAtom } from "../atoms/colorSchemeAtom"

export const isDarkSelector: Selector<boolean> = selector(
    get => get(colorSchemeAtom) === "dark",
    { name: "@valdres/browser-color-scheme/isDark" },
)
