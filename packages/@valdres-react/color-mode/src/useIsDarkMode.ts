import { isDarkModeSelector } from "@valdres/color-mode"
import { useValue } from "valdres-react"

export const useIsDarkMode = () => useValue(isDarkModeSelector)
