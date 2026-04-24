import { atom } from "valdres"
import { subscribe } from "../lib/subscribe"

export type ColorScheme = "light" | "dark"

export const COLOR_SCHEME_MEDIA = "(prefers-color-scheme: dark)"

const getInitial = (): ColorScheme => {
    if (
        typeof window === "undefined" ||
        typeof window.matchMedia !== "function"
    ) {
        return "light"
    }
    return window.matchMedia(COLOR_SCHEME_MEDIA).matches ? "dark" : "light"
}

export const colorSchemeAtom = atom<ColorScheme>(getInitial, {
    global: true,
    name: "@valdres/browser-color-scheme/colorScheme",
    onMount: () => subscribe(),
})
