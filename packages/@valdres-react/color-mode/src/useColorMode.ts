import { colorMode } from "@valdres/color-mode"
import { useValdresValue } from "valdres-react"

export const useColorMode = () => useValdresValue(colorMode)
