import { selector, type Selector } from "valdres"
import { motionAtom } from "./motionAtom"
import type { Vector3 } from "../types/MotionSnapshot"

export const accelerationIncludingGravitySelector: Selector<Vector3 | null> = selector(
    get => get(motionAtom)?.accelerationIncludingGravity ?? null,
    { name: "@valdres/browser-device-motion/accelerationIncludingGravity" },
)
