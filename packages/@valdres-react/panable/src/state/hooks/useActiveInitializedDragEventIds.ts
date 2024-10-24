import { useValue } from "valdres-react"
import { activeInitializedDragEventIds } from "../selectors/activeInitializedDragEventIds"
import type { ScopeId } from "../../types/ScopeId"

export const useActiveInitializedDragEventIds = (scopeId: ScopeId) =>
    useValue(activeInitializedDragEventIds(scopeId))
