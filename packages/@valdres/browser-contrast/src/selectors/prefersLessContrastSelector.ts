import { selector } from "valdres"
import { contrastAtom } from "../atoms/contrastAtom"

export const prefersLessContrastSelector = selector(
    get => get(contrastAtom) === "less",
    { name: "@valdres/browser-contrast/prefersLessContrast" },
)
