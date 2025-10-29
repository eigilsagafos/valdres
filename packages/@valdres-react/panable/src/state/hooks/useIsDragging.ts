import { useValue } from "valdres-react"
import { isDraggingSelector } from "../selectors/isDraggingSelector"

export const useIsDragging = () => useValue(isDraggingSelector)
