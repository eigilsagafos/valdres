import { selector, type Selector } from "valdres"
import { reducedTransparencyAtom } from "../atoms/reducedTransparencyAtom"

export const prefersReducedTransparencySelector: Selector<boolean> = selector(
    get => get(reducedTransparencyAtom) === "reduce",
    { name: "@valdres/browser-reduced-transparency/prefersReducedTransparency" },
)
