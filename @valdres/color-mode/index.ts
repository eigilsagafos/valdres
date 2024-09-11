// if (
//     window.matchMedia &&
//     window.matchMedia("(prefers-color-scheme: dark)").matches
// ) {
//     // dark mode
// }

import { atom } from "../valdres"

// window
//     .matchMedia("(prefers-color-scheme: dark)")
//     .addEventListener("change", event => {
//         const newColorScheme = event.matches ? "dark" : "light"
//     })

export const isDarkModeAtom = atom(() => {})
