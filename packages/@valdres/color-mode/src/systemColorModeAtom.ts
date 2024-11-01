import { atom } from "valdres"
import { getSystemColorMode } from "./getSystemColorMode"
import { prefersColorSchemeDark } from "./prefersColorSchemeDark"
import type { ColorMode } from "../types/ColorMode"

export const systemColorModeAtom = atom<ColorMode>(getSystemColorMode, {
    global: true,
    label: "@valdres/color-mode/systemColorModeAtom",
})

window?.matchMedia(prefersColorSchemeDark)?.addEventListener("change", () => {
    systemColorModeAtom.setSelf(getSystemColorMode())
})
