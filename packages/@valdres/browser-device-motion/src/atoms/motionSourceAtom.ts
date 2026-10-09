import { externalAtom, type ExternalAtom } from "valdres"
import { motionSource } from "../lib/motionSource"
import type { MotionState } from "../types/MotionState"

/**
 * Internal: the one source behind `motionAtom` and `motionStatusAtom`, so a
 * reading and the status it was published with are never seen apart.
 */
export const motionSourceAtom: ExternalAtom<MotionState> = externalAtom(
    motionSource,
    { name: "@valdres/browser-device-motion/source" },
)
