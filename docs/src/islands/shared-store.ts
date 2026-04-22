import { atom, store } from "valdres"
import {
    colorModeSelector,
    systemColorModeAtom,
    userSelectedColorModeAtom,
    getSystemColorMode,
} from "@valdres/color-mode"
// Single shared store for the entire docs site
export const docsStore = store("docs")

// Initialize system color mode from actual preference
const savedTheme = typeof localStorage !== "undefined"
    ? localStorage.getItem("theme")
    : null

if (savedTheme === "light" || savedTheme === "dark") {
    docsStore.set(userSelectedColorModeAtom, savedTheme)
} else {
    docsStore.set(userSelectedColorModeAtom, "system")
}
docsStore.set(systemColorModeAtom, getSystemColorMode())

// Keep system atom in sync with OS preference changes
if (typeof window !== "undefined") {
    window
        .matchMedia("(prefers-color-scheme: dark)")
        .addEventListener("change", e => {
            docsStore.set(systemColorModeAtom, e.matches ? "dark" : "light")
        })
}

// Sync color mode to DOM + localStorage
docsStore.sub(colorModeSelector, () => {
    const mode = docsStore.get(colorModeSelector)
    document.documentElement.classList.add("theme-transition")
    if (mode === "dark") {
        document.documentElement.classList.add("dark")
    } else {
        document.documentElement.classList.remove("dark")
    }
    setTimeout(() => document.documentElement.classList.remove("theme-transition"), 350)
})

// Shared counter atom for the cross-framework demo
export const countAtom = atom(0)
