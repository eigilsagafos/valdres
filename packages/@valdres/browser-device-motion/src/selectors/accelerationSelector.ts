import { selector, type Selector } from "valdres"
import { motionAtom } from "./motionAtom"
import type { Vector3 } from "../types/MotionSnapshot"

export const accelerationSelector: Selector<Vector3 | null> = selector(
    get => get(motionAtom)?.acceleration ?? null,
    { name: "@valdres/browser-device-motion/acceleration" },
)
