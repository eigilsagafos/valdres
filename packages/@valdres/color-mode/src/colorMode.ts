import { atom } from "valdres"
import { getSystemColorMode } from "./getSystemColorMode"
import { prefersColorSchemeDark } from "./prefersColorSchemeDark"
import type { ColorMode } from "../types/ColorMode"

export const colorMode = atom<ColorMode>(getSystemColorMode, {
    onInit: setSelf => {
        window
            ?.matchMedia(prefersColorSchemeDark)
            ?.addEventListener("change", () => {
                setSelf(getSystemColorMode())
            })
    },
})
