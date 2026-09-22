import { externalAtom, type ExternalAtom } from "valdres"
import { reducedTransparencySource } from "../lib/reducedTransparencySource"
import type { ReducedTransparency } from "../types/ReducedTransparency"

export const reducedTransparencyAtom: ExternalAtom<ReducedTransparency> = externalAtom(
    reducedTransparencySource,
    { name: "@valdres/browser-reduced-transparency/reducedTransparency" },
)
