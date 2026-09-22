import { selector, type Selector } from "valdres"
import { contrastAtom } from "../atoms/contrastAtom"

export const prefersMoreContrastSelector: Selector<boolean> = selector(
    get => get(contrastAtom) === "more",
    { name: "@valdres/browser-contrast/prefersMoreContrast" },
)
