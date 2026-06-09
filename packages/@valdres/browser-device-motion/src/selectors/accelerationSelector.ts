import { selector } from "valdres"
import { motionAtom } from "../atoms/motionAtom"

export const accelerationSelector = selector(
    get => get(motionAtom)?.acceleration ?? null,
    { name: "@valdres/browser-device-motion/acceleration" },
)
