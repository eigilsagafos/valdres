import { selector, type Selector } from "valdres"
import { colorSchemeAtom } from "../atoms/colorSchemeAtom"

export const isLightSelector: Selector<boolean> = selector(
    get => get(colorSchemeAtom) === "light",
    { name: "@valdres/browser-color-scheme/isLight" },
)
