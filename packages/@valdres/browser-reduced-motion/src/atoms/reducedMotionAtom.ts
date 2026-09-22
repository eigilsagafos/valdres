import { externalAtom, type ExternalAtom } from "valdres"
import { reducedMotionSource } from "../lib/reducedMotionSource"
import type { ReducedMotion } from "../types/ReducedMotion"

export const reducedMotionAtom: ExternalAtom<ReducedMotion> = externalAtom(
    reducedMotionSource,
    { name: "@valdres/browser-reduced-motion/reducedMotion" },
)
