import { selector } from "valdres"
import { reducedDataAtom } from "../atoms/reducedDataAtom"

export const prefersReducedDataSelector = selector(
    get => get(reducedDataAtom) === "reduce",
    { name: "@valdres/browser-reduced-data/prefersReducedData" },
)
