import { selectorFamily } from "valdres-react"
import { actionAtom } from "../atoms/actionAtom"
import { getCursorPositionRelative } from "../../utils/getCursorPositionRelative"
import { type EventId } from "../../types/EventId"
import { type ScopeId } from "../../types/ScopeId"

export const selectionCoordinatesSelector = selectorFamily<
    { eventId: EventId; scopeId: ScopeId },
    { x: number; y: number; w: number; h: number }
>(
    ({ eventId, scopeId }) =>
        get => {
            const action = get(actionAtom({ eventId, scopeId }))
            if (action?.kind !== "select") return { x: 0, y: 0, w: 0, h: 0 }
            const { x: x1, y: y1 } = action.startPosition
            const { x: x2, y: y2 } = getCursorPositionRelative(get, scopeId)

            return {
                x: Math.min(x1, x2),
                y: Math.min(y1, y2),
                w: Math.abs(x2 - x1),
                h: Math.abs(y2 - y1),
            }
        },
    {
        name: "selectionCoordinatesSelector",
    },
)
