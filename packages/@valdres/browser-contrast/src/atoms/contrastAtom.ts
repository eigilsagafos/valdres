import { atom } from "valdres"
import { subscribe } from "../lib/subscribe"

export type Contrast = "no-preference" | "more" | "less" | "custom"

export const CONTRAST_QUERIES: { value: Contrast; query: string }[] = [
    { value: "more", query: "(prefers-contrast: more)" },
    { value: "less", query: "(prefers-contrast: less)" },
    { value: "custom", query: "(prefers-contrast: custom)" },
]

export const readContrast = (): Contrast => {
    if (typeof window === "undefined" || !window.matchMedia) {
        return "no-preference"
    }
    for (const { value, query } of CONTRAST_QUERIES) {
        if (window.matchMedia(query).matches) return value
    }
    return "no-preference"
}

export const contrastAtom = atom<Contrast>(readContrast, {
    global: true,
    name: "@valdres/browser-contrast/contrast",
    onInit: () => subscribe(),
})
