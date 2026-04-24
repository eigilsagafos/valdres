import { atom } from "valdres"
import { subscribe } from "../lib/subscribe"

export type ReducedTransparency = "no-preference" | "reduce"

export const REDUCED_TRANSPARENCY_MEDIA = "(prefers-reduced-transparency: reduce)"

const getInitial = (): ReducedTransparency => {
    if (typeof window === "undefined" || !window.matchMedia) {
        return "no-preference"
    }
    return window.matchMedia(REDUCED_TRANSPARENCY_MEDIA).matches
        ? "reduce"
        : "no-preference"
}

export const reducedTransparencyAtom = atom<ReducedTransparency>(getInitial, {
    global: true,
    name: "@valdres/browser-reduced-transparency/reducedTransparency",
    onInit: () => subscribe(),
})
