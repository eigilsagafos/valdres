import { draggableItemAtom } from "@valdres-react/draggable"
import type { Transaction } from "valdres"
import { actionAtom } from "../atoms/actionAtom"
import { activeActionsAtom } from "../atoms/activeActionsAtom"

export const updateDragActionsAfterMove = (
    txn: Transaction,
    deltaX: number,
    deltaY: number,
) => {
    const dragActions = txn
        .get(activeActionsAtom)
        .filter(([, kind]) => kind === "drag")
        .map(([eventId]) => txn.get(actionAtom(eventId)))
    if (dragActions.length > 0) {
        dragActions.forEach(action => {
            const draggableId = action.id
            txn.set(draggableItemAtom(draggableId), curr => ({
                ...curr,
                x: curr.x + deltaX,
                y: curr.y + deltaY,
            }))
            txn.set(actionAtom(action.eventId), curr => ({
                ...curr,
                x: curr.x - deltaX,
                y: curr.y - deltaY,
            }))
        })
    }
}
