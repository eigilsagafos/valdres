import { selector } from "valdres"
import { colorSchemeAtom } from "../atoms/colorSchemeAtom"

export const isLightSelector = selector(
    get => get(colorSchemeAtom) === "light",
    { name: "@valdres/browser-color-scheme/isLight" },
)
