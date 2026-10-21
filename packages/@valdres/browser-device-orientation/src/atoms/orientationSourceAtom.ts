import { externalAtom, type ExternalAtom } from "valdres"
import { orientationSource } from "../lib/orientationSource"
import type { OrientationState } from "../types/OrientationState"

/**
 * Internal: the one source behind `orientationAtom` and `orientationStatusAtom`, so a
 * reading and the status it was published with are never seen apart.
 */
export const orientationSourceAtom: ExternalAtom<OrientationState> = externalAtom(
    orientationSource,
    { name: "@valdres/browser-device-orientation/source" },
)
