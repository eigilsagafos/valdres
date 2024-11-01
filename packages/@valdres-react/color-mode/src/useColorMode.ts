import { colorModeSelector } from "@valdres/color-mode"
import { useValue } from "valdres-react"

export const useColorMode = () => useValue(colorModeSelector)
