import { selector } from "valdres"
import { reducedTransparencyAtom } from "../atoms/reducedTransparencyAtom"

export const prefersReducedTransparencySelector = selector(
    get => get(reducedTransparencyAtom) === "reduce",
    { name: "@valdres/browser-reduced-transparency/prefersReducedTransparency" },
)
