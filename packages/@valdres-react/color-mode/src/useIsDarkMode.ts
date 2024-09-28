import { isDarkMode } from "@valdres/color-mode"
import { useValue } from "valdres-react"

export const useIsDarkMode = () => useValue(isDarkMode)
