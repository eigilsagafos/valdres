import { isLightMode } from "@valdres/color-mode"
import { useValdresValue } from "valdres-react"

export const useIsLightMode = () => useValdresValue(isLightMode)
