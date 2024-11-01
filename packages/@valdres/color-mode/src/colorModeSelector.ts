import { selector } from "valdres"
import { systemColorModeAtom } from "./systemColorModeAtom"
import { userSelectedColorModeAtom } from "./userSelectedColorModeAtom"
import type { ColorMode } from "../types/ColorMode"

export const colorModeSelector = selector<ColorMode>(
    get => {
        const userSelectedMode = get(userSelectedColorModeAtom)
        if (userSelectedMode === "system") return get(systemColorModeAtom)
        return userSelectedMode
    },
    {
        label: "@valdres/color-mode/colorModeSelector",
    },
)
