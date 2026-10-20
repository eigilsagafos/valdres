import { selector, type Selector } from "valdres"
import { motionSourceAtom } from "../atoms/motionSourceAtom"
import type { MotionSnapshot } from "../types/MotionSnapshot"

/**
 * The latest `devicemotion` reading, or `null`. Subscribing attaches the
 * window's shared listener; it never prompts. A read-only Selector.
 */
export const motionAtom: Selector<MotionSnapshot | null> = selector(
    get => get(motionSourceAtom).motion,
    { name: "@valdres/browser-device-motion/motion" },
)
