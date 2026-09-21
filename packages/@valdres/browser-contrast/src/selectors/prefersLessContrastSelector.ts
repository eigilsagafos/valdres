import { selector, type Selector } from "valdres"
import { contrastAtom } from "../atoms/contrastAtom"

export const prefersLessContrastSelector: Selector<boolean> = selector(
    get => get(contrastAtom) === "less",
    { name: "@valdres/browser-contrast/prefersLessContrast" },
)
