import { selector, type Selector } from "valdres"
import { reducedDataAtom } from "../atoms/reducedDataAtom"

export const prefersReducedDataSelector: Selector<boolean> = selector(
    get => get(reducedDataAtom) === "reduce",
    { name: "@valdres/browser-reduced-data/prefersReducedData" },
)
