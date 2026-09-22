import { externalAtom, type ExternalAtom } from "valdres"
import { reducedDataSource } from "../lib/reducedDataSource"
import type { ReducedData } from "../types/ReducedData"

export const reducedDataAtom: ExternalAtom<ReducedData> = externalAtom(
    reducedDataSource,
    { name: "@valdres/browser-reduced-data/reducedData" },
)
