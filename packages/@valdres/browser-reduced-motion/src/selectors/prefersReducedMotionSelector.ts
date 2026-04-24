import { selector } from "valdres"
import { reducedMotionAtom } from "../atoms/reducedMotionAtom"

export const prefersReducedMotionSelector = selector(
    get => get(reducedMotionAtom) === "reduce",
    { name: "@valdres/browser-reduced-motion/prefersReducedMotion" },
)
