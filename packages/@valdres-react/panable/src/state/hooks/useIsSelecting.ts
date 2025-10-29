import { useValue } from "valdres-react"
import { isSelectingSelector } from "../selectors/isSelectingSelector"

export const useIsSelecting = () => useValue(isSelectingSelector)
