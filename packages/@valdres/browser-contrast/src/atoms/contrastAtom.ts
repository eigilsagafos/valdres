import { externalAtom, type ExternalAtom } from "valdres"
import { contrastSource } from "../lib/contrastSource"
import type { Contrast } from "../types/Contrast"

export const contrastAtom: ExternalAtom<Contrast> = externalAtom(
    contrastSource,
    { name: "@valdres/browser-contrast/contrast" },
)
