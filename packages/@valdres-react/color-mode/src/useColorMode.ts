import { colorMode } from "@valdres/color-mode"
import { useRecoilValue } from "valdres-react"

export const useColorMode = () => useRecoilValue(colorMode)
