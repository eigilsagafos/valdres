import { selector } from "valdres"
import type { DragAction } from "../../types/DragAction"
import { actionAtom } from "../atoms/actionAtom"
import { activeActionsAtom } from "../atoms/activeActionsAtom"

export const activeInitializedDragEventIds = selector(
    get => {
        return get(activeActionsAtom)
            .filter(([eventId, kind]) => {
                if (kind !== "drag") return false
                const action = get(actionAtom(eventId)) as DragAction
                if (!action.initialized) return false
                return true
            })
            .map(([eventId]) => eventId)
    },
    { name: "@valdres-react/panable/activeInitializedDragEventIds" },
)
