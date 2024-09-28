import { isLightMode } from "@valdres/color-mode"
import { useValue } from "valdres-react"

export const useIsLightMode = () => useValue(isLightMode)
