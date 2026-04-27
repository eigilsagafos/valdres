import { selector } from "valdres"
import { motionAtom } from "../atoms/motionAtom"

export const accelerationIncludingGravitySelector = selector(
    get => get(motionAtom)?.accelerationIncludingGravity ?? null,
    { name: "@valdres/browser-device-motion/accelerationIncludingGravity" },
)
