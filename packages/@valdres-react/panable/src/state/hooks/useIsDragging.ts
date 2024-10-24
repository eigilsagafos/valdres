import { useValue } from "valdres-react"
import { isDraggingSelector } from "../selectors/isDraggingSelector"
import { type ScopeId } from "../../types/ScopeId"

export const useIsDragging = (scopeId: ScopeId) =>
    useValue(isDraggingSelector(scopeId))
