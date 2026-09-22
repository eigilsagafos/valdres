import { selector, type Selector } from "valdres"
import { reducedMotionAtom } from "../atoms/reducedMotionAtom"

export const prefersReducedMotionSelector: Selector<boolean> = selector(
    get => get(reducedMotionAtom) === "reduce",
    { name: "@valdres/browser-reduced-motion/prefersReducedMotion" },
)
