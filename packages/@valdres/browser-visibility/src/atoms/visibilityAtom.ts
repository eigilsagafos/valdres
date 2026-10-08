import { externalAtom, type ExternalAtom } from "valdres"
import { visibilitySource } from "../lib/visibilitySource"
import type { PageVisibility } from "../types/PageVisibility"

export const visibilityAtom: ExternalAtom<PageVisibility> = externalAtom(
    visibilitySource,
    { name: "@valdres/browser-visibility/visibility" },
)
