import { selector } from "valdres"
import { contrastAtom } from "../atoms/contrastAtom"

export const prefersMoreContrastSelector = selector(
    get => get(contrastAtom) === "more",
    { name: "@valdres/browser-contrast/prefersMoreContrast" },
)
