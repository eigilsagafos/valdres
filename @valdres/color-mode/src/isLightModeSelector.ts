import { selector } from "../../valdres"
import { colorModeAtom } from "./colorModeAtom"
import { ColorMode } from "../types/ColorMode"

export const isLightModeSelector = selector(
    get => get(colorModeAtom) === ColorMode.Light,
)
