import { selector, type Selector } from "valdres"
import { motionAtom } from "./motionAtom"
import type { RotationRateSnapshot } from "../types/MotionSnapshot"

export const rotationRateSelector: Selector<RotationRateSnapshot | null> = selector(
    get => get(motionAtom)?.rotationRate ?? null,
    { name: "@valdres/browser-device-motion/rotationRate" },
)
