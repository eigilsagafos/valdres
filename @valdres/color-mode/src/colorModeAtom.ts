import { atom } from "../../valdres"
import type { ColorMode } from "../types/ColorMode"
import { getSystemColorMode } from "./getSystemColorMode"
import { prefersColorSchemeDark } from "./prefersColorSchemeDark"

export const colorModeAtom = atom<ColorMode>(getSystemColorMode, {
    onInit: setSelf => {
        window
            ?.matchMedia(prefersColorSchemeDark)
            ?.addEventListener("change", () => {
                setSelf(getSystemColorMode())
            })
    },
})
