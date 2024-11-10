import { selector } from "valdres"
import { colorModeSelector } from "./colorModeSelector"

export const isDarkModeSelector = selector(
    get => get(colorModeSelector) === "dark",
)
