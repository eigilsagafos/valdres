import { selector } from "valdres"
import { colorModeSelector } from "./colorModeSelector"

export const isDarkMode = selector(get => get(colorModeSelector) === "dark")
