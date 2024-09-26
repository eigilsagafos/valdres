import { isDarkMode } from "@valdres/color-mode"
import { useValdresValue } from "valdres-react"

export const useIsDarkMode = () => useValdresValue(isDarkMode)
