import { selector } from "valdres"
import { colorMode } from "./colorMode"
import { ColorMode } from "../types/ColorMode"

export const isLightMode = selector(get => get(colorMode) === ColorMode.Light)
