import { selector } from "../../valdres"
import { colorModeAtom } from "./colorModeAtom"
import { ColorMode } from "../types/ColorMode"

export const isDarkModeSelector = selector(
    get => get(colorModeAtom) === ColorMode.Dark,
)
