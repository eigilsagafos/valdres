import { atom } from "valdres"
import { subscribe } from "../lib/subscribe"

export type ReducedData = "no-preference" | "reduce"

export const REDUCED_DATA_MEDIA = "(prefers-reduced-data: reduce)"

const getInitial = (): ReducedData => {
    if (typeof window === "undefined" || !window.matchMedia) {
        return "no-preference"
    }
    return window.matchMedia(REDUCED_DATA_MEDIA).matches
        ? "reduce"
        : "no-preference"
}

export const reducedDataAtom = atom<ReducedData>(getInitial, {
    global: true,
    name: "@valdres/browser-reduced-data/reducedData",
    onInit: () => subscribe(),
})
