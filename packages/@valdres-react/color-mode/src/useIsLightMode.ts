import { isLightMode } from "@valdres/color-mode"
import { useRecoilValue } from "valdres-react"

export const useIsLightMode = () => useRecoilValue(isLightMode)
