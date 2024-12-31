import { draggableItemAtom } from "@valdres-react/draggable"
import { actionAtom } from "../atoms/actionAtom"
import { activeActionsAtom } from "../atoms/activeActionsAtom"
import type { TransactionInterface } from "valdres"
import type { ScopeId } from "../../types/ScopeId"

export const updateDragActionsAfterMove = (
    txn: TransactionInterface,
    scopeId: ScopeId,
    deltaX: number,
    deltaY: number,
) => {
    const dragActions = txn
        .get(activeActionsAtom(scopeId))
        .filter(([, kind]) => kind === "drag")
        .map(([eventId]) => txn.get(actionAtom({ eventId, scopeId })))
    if (dragActions.length > 0) {
        dragActions.forEach(action => {
            const draggableId = {
                ref: action.meta.item.ref,
                context: action.meta.item.context,
                scopeId,
            }
            txn.set(draggableItemAtom(draggableId), curr => ({
                ...curr,
                x: curr.x + deltaX,
                y: curr.y + deltaY,
            }))
            txn.set(actionAtom({ eventId: action.eventId, scopeId }), curr => ({
                ...curr,
                x: curr.x - deltaX,
                y: curr.y - deltaY,
            }))
        })
    }
}
