import { selectorFamily } from "valdres-react"
import type { DragAction } from "../../types/DragAction"
import type { EventId } from "../../types/EventId"
import type { ScopeId } from "../../types/ScopeId"
import { actionAtom } from "../atoms/actionAtom"
import { activeActionsAtom } from "../atoms/activeActionsAtom"

export const activeInitializedDragEventIds = selectorFamily<ScopeId, EventId[]>(
    scopeId => get => {
        return get(activeActionsAtom(scopeId))
            .filter(([eventId, kind]) => {
                if (kind !== "drag") return false
                const action = get(
                    actionAtom({ eventId, scopeId }),
                ) as DragAction
                if (!action.initialized) return false
                return true
            })
            .map(([eventId]) => eventId)
    },
    {
        label: "@valdres-react/panable/activeInitializedDragEventIds",
    },
)
