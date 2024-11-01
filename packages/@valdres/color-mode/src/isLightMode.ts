import { selector } from "valdres"
import { colorModeSelector } from "./colorModeSelector"

export const isLightMode = selector(get => get(colorModeSelector) === "light")
