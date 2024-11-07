import { atom } from "valdres"
import { getSystemColorMode } from "./getSystemColorMode"
import { prefersColorSchemeDark } from "./prefersColorSchemeDark"
import type { ColorMode } from "../types/ColorMode"

export const systemColorModeAtom = atom<ColorMode>(getSystemColorMode, {
    global: true,
    name: "@valdres/color-mode/systemColorModeAtom",
    onInit: () => {
        const listener = () => {
            systemColorModeAtom.setSelf(getSystemColorMode())
        }
        window
            ?.matchMedia(prefersColorSchemeDark)
            ?.addEventListener("change", listener)

        return () => {
            window
                ?.matchMedia(prefersColorSchemeDark)
                ?.removeEventListener("change", listener)
        }
    },
})
