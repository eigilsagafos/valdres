import type { Transaction } from "valdres"
import { actionAtom } from "../atoms/actionAtom"
import { cameraPositionAtom } from "../atoms/cameraPositionAtom"
import { scaleAtom } from "../atoms/scaleAtom"
import { updateDragActionsAfterMove } from "./updateDragActionsAfterMove"
import type { ScopeId } from "../../types/ScopeId"
import type { EventId } from "../../types/EventId"

export const move = (
    txn: Transaction,
    scopeId: ScopeId,
    eventId: EventId,
    x: number,
    y: number,
) => {
    const action = txn.get(actionAtom({ eventId, scopeId }))
    const { initialCameraPosition, initialMousePosition } = action
    const scale = txn.get(scaleAtom(scopeId))
    const cameraPos = txn.get(cameraPositionAtom(scopeId))
    const newX = initialCameraPosition.x - (initialMousePosition.x - x) / scale
    const newY = initialCameraPosition.y - (initialMousePosition.y - y) / scale

    const xDiff = Math.abs(action.initialMousePosition.x - x)
    const yDiff = Math.abs(action.initialMousePosition.y - y)
    if (!(xDiff > 3 || yDiff > 3)) {
        return
    } else {
        txn.set(cameraPositionAtom(scopeId), {
            x: newX,
            y: newY,
            animate: false,
        })

        txn.set(actionAtom({ eventId, scopeId }), curr => ({
            ...curr,
            initialized: true,
        }))

        const deltaX = cameraPos.x - newX
        const deltaY = cameraPos.y - newY
        updateDragActionsAfterMove(txn, scopeId, deltaX, deltaY)
    }
}
