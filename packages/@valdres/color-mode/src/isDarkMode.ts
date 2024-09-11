import { selector } from "valdres"
import { colorMode } from "./colorMode"
import { ColorMode } from "../types/ColorMode"

export const isDarkMode = selector(get => get(colorMode) === ColorMode.Dark)
