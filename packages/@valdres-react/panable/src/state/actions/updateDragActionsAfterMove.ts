import { draggableItemAtom } from "@valdres-react/draggable"
import type { Store } from "valdres"
import { actionAtom } from "../atoms/actionAtom"
import { activeActionsAtom } from "../atoms/activeActionsAtom"

export const updateDragActionsAfterMove = (
    store: Store,
    deltaX: number,
    deltaY: number,
) => {
    const dragActions = store
        .get(activeActionsAtom)
        .filter(([, kind]) => kind === "drag")
        .map(([eventId]) => store.get(actionAtom(eventId)))
    if (dragActions.length > 0) {
        dragActions.forEach(action => {
            const draggableId = action.id
            store.set(draggableItemAtom(draggableId), curr => ({
                ...curr,
                x: curr.x + deltaX,
                y: curr.y + deltaY,
            }))
            store.set(actionAtom(action.eventId), curr => ({
                ...curr,
                x: curr.x - deltaX,
                y: curr.y - deltaY,
            }))
        })
    }
}
