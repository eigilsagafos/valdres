import { useValue } from "valdres-react"
import { cursorPositionRelativeSelector } from "../selectors/cursorPositionRelativeSelector"
import type { ScopeId } from "../../types/ScopeId"

export const useCursorPositionRelative = (
    scopeId: ScopeId,
    innerCanvas: boolean = false,
) => useValue(cursorPositionRelativeSelector({ scopeId, innerCanvas }))
