import { selector } from "valdres"
import { motionAtom } from "../atoms/motionAtom"

export const rotationRateSelector = selector(
    get => get(motionAtom)?.rotationRate ?? null,
    { name: "@valdres/browser-device-motion/rotationRate" },
)
