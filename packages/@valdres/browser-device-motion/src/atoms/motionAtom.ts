import { globalAtom } from "valdres"
import type { GlobalAtom } from "valdres"
import type { MotionSnapshot } from "../types/MotionSnapshot"
import { subscribe } from "../lib/subscribe"

export const motionAtom: GlobalAtom<MotionSnapshot | null> = globalAtom<
    MotionSnapshot | null
>(null, {
    name: "@valdres/browser-device-motion/motion",
    onMount: () => subscribe(motionAtom),
})
