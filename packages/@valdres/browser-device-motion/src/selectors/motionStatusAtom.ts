import { selector, type Selector } from "valdres"
import { motionSourceAtom } from "../atoms/motionSourceAtom"
import type { MotionStatus } from "../types/MotionStatus"

export const motionStatusAtom: Selector<MotionStatus> = selector(
    get => get(motionSourceAtom).status,
    { name: "@valdres/browser-device-motion/status" },
)
