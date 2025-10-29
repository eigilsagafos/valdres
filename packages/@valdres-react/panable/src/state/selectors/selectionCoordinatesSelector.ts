import { selectorFamily } from "valdres"
import type { EventId } from "../../types/EventId"
import { getCursorPositionRelative } from "../../utils/getCursorPositionRelative"
import { actionAtom } from "../atoms/actionAtom"

export const selectionCoordinatesSelector = selectorFamily(
    (eventId: EventId) => get => {
        const action = get(actionAtom(eventId))
        if (action?.kind !== "select") return { x: 0, y: 0, w: 0, h: 0 }
        const { x: x1, y: y1 } = action.startPosition
        const { x: x2, y: y2 } = getCursorPositionRelative(get)

        return {
            x: Math.min(x1, x2),
            y: Math.min(y1, y2),
            w: Math.abs(x2 - x1),
            h: Math.abs(y2 - y1),
        }
    },
    { name: "selectionCoordinatesSelector" },
)
