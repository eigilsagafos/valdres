import { isDarkMode } from "@valdres/color-mode"
import { useRecoilValue } from "valdres-react"

export const useIsDarkMode = () => useRecoilValue(isDarkMode)
