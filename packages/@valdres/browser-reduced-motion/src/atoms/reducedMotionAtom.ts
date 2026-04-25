import { atom } from "valdres"
import { subscribe } from "../lib/subscribe"

export type ReducedMotion = "no-preference" | "reduce"

export const REDUCED_MOTION_MEDIA = "(prefers-reduced-motion: reduce)"

const getInitial = (): ReducedMotion => {
    if (
        typeof window === "undefined" ||
        typeof window.matchMedia !== "function"
    ) {
        return "no-preference"
    }
    return window.matchMedia(REDUCED_MOTION_MEDIA).matches
        ? "reduce"
        : "no-preference"
}

export const reducedMotionAtom = atom<ReducedMotion>(getInitial, {
    global: true,
    name: "@valdres/browser-reduced-motion/reducedMotion",
    onInit: () => subscribe(),
})
