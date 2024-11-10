import { selector } from "valdres"
import { colorModeSelector } from "./colorModeSelector"

export const isLightModeSelector = selector(
    get => get(colorModeSelector) === "light",
)
