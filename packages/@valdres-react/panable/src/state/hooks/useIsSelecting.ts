import { useValue } from "valdres-react"
import { isSelectingSelector } from "../selectors/isSelectingSelector"
import type { ScopeId } from "../../types/ScopeId"

export const useIsSelecting = (scopeId: ScopeId) =>
    useValue(isSelectingSelector(scopeId))
